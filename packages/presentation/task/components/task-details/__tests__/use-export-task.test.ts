// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTaskDetailsStore } from '../../../stores'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import type { TaskDetailsViewObject } from '../types'
import useExportTask, { MAX_EXPORT_DEPTH } from '../use-export-task'

vi.mock('nue-ui', () => ({
    NueMessage: { success: vi.fn(), error: vi.fn() }
}))

/**
 * 导出任务 composable 断言（T21）
 * @description 覆盖递归取数（含分页取尽/深度上限）、任务树组装、错误提示与剪贴板复制。
 */

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject => ({
    id: 'task',
    createdAt: '2026-09-19 08:00:00',
    updatedAt: '2026-09-19 20:00:00',
    deletedAt: null,
    parentTaskId: '',
    userId: 'u1',
    name: '任务',
    description: '',
    state: 'todo',
    priority: 'low',
    startAt: null,
    endAt: null,
    projectId: null,
    tags: [],
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: null,
    remindRepeat: 'none',
    remindTime: null,
    remindWeekdays: [],
    checkItemCount: 0,
    commentCount: 0,
    subtaskCount: 0,
    sortId: 0,
    isDeleted: false,
    isArchived: false,
    isStarMarked: false,
    isGivenUp: false,
    ...overrides
})

// 根任务 + 一层子任务（c1 含孙任务 g1）
const ROOT = makeTask({ id: 'root', name: '根任务' })
const TASKS: Record<string, TaskViewObject> = {
    root: ROOT,
    c1: makeTask({ id: 'c1', parentTaskId: 'root', name: '子 1', state: 'done', sortId: 1000 }),
    c2: makeTask({ id: 'c2', parentTaskId: 'root', name: '子 2', sortId: 2000 }),
    g1: makeTask({ id: 'g1', parentTaskId: 'c1', name: '孙 1', sortId: 1000 })
}

let wrappers: VueWrapper[] = []

type ListResult = [
    {
        taskIds: string[]
        pagination?: { total: number; page: number; limit: number; maxPage: number }
    } | null,
    string | null
]

const setup = (
    listImpl: (options: { parentTaskId?: string; page?: number }) => Promise<ListResult>
) => {
    setActivePinia(createPinia())
    const store = useTaskDetailsStore()
    store.addTasks(Object.values(TASKS))

    const list = vi.fn(listImpl)
    const subTaskUseCase = { list } as unknown as TaskUseCase
    const vo = ref<TaskDetailsViewObject | null>(ROOT as TaskDetailsViewObject)

    let api: ReturnType<typeof useExportTask> | null = null
    const wrapper = mount(
        defineComponent({
            setup() {
                api = useExportTask()
                return () => null
            }
        }),
        {
            global: {
                provide: {
                    [TASK_DETAILS_CONTEXT_KEY as symbol]: {
                        vo,
                        checkItems: computed(() => [])
                    },
                    [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: {
                        subTaskUseCase,
                        getTag: () => undefined,
                        getProjectName: () => ''
                    }
                }
            }
        }
    )
    wrappers.push(wrapper)
    return { api: api!, list }
}

const pageOf = (taskIds: string[], maxPage = 1, page = 1) =>
    [
        { taskIds, pagination: { total: taskIds.length, page, limit: 100, maxPage } },
        null
    ] as ListResult

beforeEach(() => {
    wrappers = []
    vi.mocked(NueMessage.success).mockClear()
    vi.mocked(NueMessage.error).mockClear()
})

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('useExportTask - 递归取数', () => {
    it('逐层 list({ parentTaskId })，子任务按组内序递归输出', async () => {
        const children: Record<string, string[]> = { root: ['c2', 'c1'], c1: ['g1'] }
        const { api, list } = setup(async ({ parentTaskId }) =>
            pageOf(children[parentTaskId ?? ''] ?? [])
        )

        const md = await api.exportTask()

        expect(list).toHaveBeenCalledTimes(4)
        expect(list).toHaveBeenCalledWith({ parentTaskId: 'root', page: 1, limit: 100 })
        expect(md).toContain(
            ['## 子任务', '', '- [x] 子 1', '  - [ ] 孙 1', '- [ ] 子 2'].join('\n')
        )
    })

    it('分页未取尽时续取，直至 maxPage', async () => {
        const { api, list } = setup(async ({ parentTaskId, page }) => {
            if (parentTaskId === 'root') return pageOf(page === 1 ? ['c1'] : ['c2'], 2, page ?? 1)
            return pageOf([])
        })

        const md = await api.exportTask()

        expect(list).toHaveBeenCalledWith({ parentTaskId: 'root', page: 1, limit: 100 })
        expect(list).toHaveBeenCalledWith({ parentTaskId: 'root', page: 2, limit: 100 })
        expect(md).toContain(['- [x] 子 1', '- [ ] 子 2'].join('\n'))
    })

    it('深度上限：异常数据（自引用）不会无限递归', async () => {
        const { api, list } = setup(async () => pageOf(['c1']))
        await api.exportTask()
        expect(list).toHaveBeenCalledTimes(MAX_EXPORT_DEPTH)
    })

    it('取数失败 ⇒ 返回 null、记录错误并提示', async () => {
        const { api } = setup(async () => [null, 'boom'])
        const md = await api.exportTask()
        expect(md).toBeNull()
        expect(api.error.value).toBe('boom')
        expect(NueMessage.error).toHaveBeenCalledTimes(1)
    })
})

describe('useExportTask - 复制到剪贴板', () => {
    it('成功 ⇒ 写入剪贴板并成功提示', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true
        })
        const { api } = setup(async () => pageOf([]))

        const ok = await api.copyMarkdown('# 任务')

        expect(ok).toBe(true)
        expect(writeText).toHaveBeenCalledWith('# 任务')
        expect(NueMessage.success).toHaveBeenCalledTimes(1)
    })

    it('写入失败 ⇒ 返回 false 并错误提示（不静默）', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('denied'))
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true
        })
        const { api } = setup(async () => pageOf([]))

        const ok = await api.copyMarkdown('# 任务')

        expect(ok).toBe(false)
        expect(NueMessage.error).toHaveBeenCalledTimes(1)
    })

    it('剪贴板不可用 ⇒ 返回 false 并错误提示', async () => {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
        const { api } = setup(async () => pageOf([]))

        const ok = await api.copyMarkdown('# 任务')

        expect(ok).toBe(false)
        expect(NueMessage.error).toHaveBeenCalledTimes(1)
    })
})