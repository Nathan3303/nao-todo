// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import type {
    TaskCheckItemUseCase,
    TaskCheckItemViewObject,
    TaskUseCase,
    TaskViewObject
} from '@nao-todo/domain-task'
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

/** 只读取数结果：[检查项视图对象列表 | null, 错误 | null] */
type CheckResult = [TaskCheckItemViewObject[] | null, string | null]

const makeCheckItem = (
    name: string,
    isDone: boolean,
    taskId: string,
    sortId = 0
): TaskCheckItemViewObject => ({
    id: `${taskId}-${name}`,
    taskId,
    name,
    description: null,
    isDone,
    sortId,
    createdAt: '2026-09-19 08:00:00',
    updatedAt: '2026-09-19 20:00:00',
    deletedAt: null
})

type SetupOptions = {
    /** 覆盖默认任务集合（用于构造描述/标签等丰富字段） */
    tasks?: Record<string, TaskViewObject>
    /** 子任务检查项只读取数（D1：不得写共享 store） */
    listByTask?: (taskId: TaskViewObject['id']) => Promise<CheckResult>
    /** 标签 ID → 视图对象（名称解析） */
    getTag?: (tagId: string) => { name: string } | undefined
}

const setup = (
    listImpl: (options: { parentTaskId?: string; page?: number }) => Promise<ListResult>,
    options: SetupOptions = {}
) => {
    setActivePinia(createPinia())
    const store = useTaskDetailsStore()
    store.addTasks(Object.values(options.tasks ?? TASKS))

    const list = vi.fn(listImpl)
    const listByTask = vi.fn(options.listByTask ?? (async () => [[], null] as CheckResult))
    const subTaskUseCase = { list } as unknown as TaskUseCase
    const taskCheckItemUseCase = { listByTask } as unknown as TaskCheckItemUseCase
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
                        taskCheckItemUseCase,
                        getTag: options.getTag ?? (() => undefined),
                        getProjectName: () => ''
                    }
                }
            }
        }
    )
    wrappers.push(wrapper)
    return { api: api!, list, listByTask, store }
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
            [
                '## 子任务',
                '',
                '- [x] 子 1（状态：已完成；优先级：低优先级）',
                '  - [ ] 孙 1',
                '- [ ] 子 2（状态：待办；优先级：低优先级）'
            ].join('\n')
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
        expect(md).toContain(
            [
                '- [x] 子 1（状态：已完成；优先级：低优先级）',
                '- [ ] 子 2（状态：待办；优先级：低优先级）'
            ].join('\n')
        )
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

/**
 * 一级子任务丰富取数（PRD §5.2 / §5.3，D1 只读约束）
 * @description 契约：预上下文提供 `taskCheckItemUseCase.listByTask(taskId)` 只读取数，
 *              不得调用会写共享 store 的 `list(taskId)`；仅对一级子任务取检查项。
 */
describe('useExportTask - 一级子任务丰富取数（AC1/AC4/AC5）', () => {
    it('一级子任务取回描述/检查项/标签并丰富输出；二级不取检查项', async () => {
        const tasks: Record<string, TaskViewObject> = {
            root: ROOT,
            c1: makeTask({
                id: 'c1',
                parentTaskId: 'root',
                name: '子 1',
                state: 'done',
                sortId: 1000,
                tags: ['t1'],
                description: '子 1 描述'
            }),
            g1: makeTask({ id: 'g1', parentTaskId: 'c1', name: '孙 1', sortId: 1000 })
        }
        const listByTask = vi.fn(async (taskId: string): Promise<CheckResult> => {
            if (taskId === 'c1') {
                return [
                    [makeCheckItem('检一', true, 'c1'), makeCheckItem('检二', false, 'c1', 1)],
                    null
                ]
            }
            return [[], null]
        })
        const { api } = setup(
            async ({ parentTaskId }) =>
                pageOf(parentTaskId === 'root' ? ['c1'] : parentTaskId === 'c1' ? ['g1'] : []),
            { tasks, listByTask, getTag: (id) => (id === 't1' ? { name: '重要' } : undefined) }
        )

        const md = await api.exportTask()

        expect(listByTask).toHaveBeenCalledWith('c1')
        expect(listByTask).not.toHaveBeenCalledWith('g1')
        expect(md).toContain(
            [
                '- [x] 子 1（状态：已完成；优先级：低优先级；标签：#重要）',
                '  - 描述：子 1 描述',
                '  - 检查项：',
                '    - [x] 检一',
                '    - [ ] 检二',
                '  - [ ] 孙 1'
            ].join('\n')
        )
    })

    it('子任务无检查项 ⇒ 整段省略（不输出「检查项：」标签行）', async () => {
        const tasks: Record<string, TaskViewObject> = {
            root: ROOT,
            c1: makeTask({ id: 'c1', parentTaskId: 'root', name: '子 1', sortId: 1000 })
        }
        const { api } = setup(
            async ({ parentTaskId }) => pageOf(parentTaskId === 'root' ? ['c1'] : []),
            { tasks, listByTask: async () => [[], null] }
        )

        const md = await api.exportTask()

        expect(md).toContain('- [ ] 子 1（状态：待办；优先级：低优先级）')
        expect(md).not.toContain('检查项：')
    })

    it('子任务检查项取数失败 ⇒ 整体失败：返回 null、记录错误、toast 一次', async () => {
        const tasks: Record<string, TaskViewObject> = {
            root: ROOT,
            c1: makeTask({ id: 'c1', parentTaskId: 'root', name: '子 1', sortId: 1000 })
        }
        const { api } = setup(
            async ({ parentTaskId }) => pageOf(parentTaskId === 'root' ? ['c1'] : []),
            { tasks, listByTask: async () => [null, 'check boom'] }
        )

        const md = await api.exportTask()

        expect(md).toBeNull()
        expect(api.error.value).toBe('check boom')
        expect(NueMessage.error).toHaveBeenCalledTimes(1)
    })

    it('取数不污染 TaskDetailsStore 的检查项（AC5 / D1 只读约束）', async () => {
        const tasks: Record<string, TaskViewObject> = {
            root: ROOT,
            c1: makeTask({ id: 'c1', parentTaskId: 'root', name: '子 1', sortId: 1000 })
        }
        const sentinel = makeCheckItem('根任务检查项', false, 'root')
        const { api, store } = setup(
            async ({ parentTaskId }) => pageOf(parentTaskId === 'root' ? ['c1'] : []),
            { tasks, listByTask: async () => [[makeCheckItem('子检查项', true, 'c1')], null] }
        )
        store.setCheckItems([sentinel])
        store.setCheckItemIds([sentinel.id])
        const beforeItems = [...store.checkItems]
        const beforeIds = [...store.checkItemIds]

        await api.exportTask()

        expect(store.checkItems).toEqual(beforeItems)
        expect(store.checkItemIds).toEqual(beforeIds)
    })
})