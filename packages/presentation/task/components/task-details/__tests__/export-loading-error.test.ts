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
import useExportTask from '../use-export-task'

vi.mock('nue-ui', () => ({
    NueMessage: { success: vi.fn(), error: vi.fn() }
}))

/**
 * TASK-22 T94 —— 导出取数状态机断言（PRD §5.1 / AC5）
 * @description 契约：
 *  - `status: 'idle' | 'loading' | 'error' | 'ready'`；
 *  - `startExport()`（开框触发）与 `retry()`（框内重试）共用实现；
 *  - 置 `loading` → 取数 → 成功 `ready`（缓存任务树 + 三格式输出）/ 失败 `error` + toast；
 *  - `status === 'loading'` 时重复触发被忽略（防重入，无并发取数）；
 *  - 成功后缓存 ⇒ 不因后续操作重复取数；`reset()` 清空缓存与三格式回 `idle`。
 *
 * ⚠️ 用例先行：`status` / `startExport` / `retry` / `reset` / `json` / `html` 属 T96，未落地 ⇒ 当前预期红。
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

const ROOT = makeTask({ id: 'root', name: '根任务' })

type ListResult = [
    {
        taskIds: string[]
        pagination?: { total: number; page: number; limit: number; maxPage: number }
    } | null,
    string | null
]

const pageOf = (taskIds: string[], maxPage = 1, page = 1): ListResult => [
    { taskIds, pagination: { total: taskIds.length, page, limit: 100, maxPage } },
    null
]

let wrappers: VueWrapper[] = []

const setup = (
    listImpl: (options: { parentTaskId?: string; page?: number }) => Promise<ListResult>
) => {
    setActivePinia(createPinia())
    const store = useTaskDetailsStore()
    store.addTasks([ROOT])

    const list = vi.fn(listImpl)
    const listByTask = vi.fn(
        async (): Promise<[TaskCheckItemViewObject[] | null, string | null]> => [[], null]
    )
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
                        subTaskUseCase: { list } as unknown as TaskUseCase,
                        taskCheckItemUseCase: { listByTask } as unknown as TaskCheckItemUseCase,
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

describe('useExportTask - 状态机（§5.1 / AC5）', () => {
    it('初始 idle；startExport 同步置 loading → 成功 ready，并产出三格式', async () => {
        const { api, list } = setup(async () => pageOf([]))

        expect(api.status.value).toBe('idle')

        const pending = api.startExport()
        expect(api.status.value).toBe('loading')
        await pending

        expect(api.status.value).toBe('ready')
        expect(api.markdown.value).toContain('# 根任务')
        expect(JSON.parse(api.json.value) as { formatVersion: number }).toMatchObject({
            formatVersion: 1
        })
        expect(api.html.value).toContain('<!DOCTYPE html>')
        expect(list).toHaveBeenCalledTimes(1)
    })

    it('取数失败 ⇒ status=error、记录错误并 toast 一次（不展示半成品）', async () => {
        const { api } = setup(async () => [null, 'boom'])

        const result = await api.startExport()

        expect(result).toBeNull()
        expect(api.status.value).toBe('error')
        expect(api.error.value).toBe('boom')
        expect(api.markdown.value).toBe('')
        expect(NueMessage.error).toHaveBeenCalledTimes(1)
        expect(String(vi.mocked(NueMessage.error).mock.calls[0]?.[0])).toContain('boom')
    })

    it('错误文案为空 ⇒ 回退 task.error.loadFailed', async () => {
        const { api } = setup(async () => [null, ''])

        await api.startExport()

        expect(api.status.value).toBe('error')
        expect(NueMessage.error).toHaveBeenCalledTimes(1)
        expect(String(vi.mocked(NueMessage.error).mock.calls[0]?.[0])).not.toBe('')
    })

    it('retry 从 error 恢复：重新取数并置 ready', async () => {
        let attempt = 0
        const { api, list } = setup(async () => {
            attempt += 1
            return attempt === 1 ? [null, 'boom'] : pageOf([])
        })

        await api.startExport()
        expect(api.status.value).toBe('error')

        await api.retry()

        expect(api.status.value).toBe('ready')
        expect(api.markdown.value).toContain('# 根任务')
        expect(list).toHaveBeenCalledTimes(2)
    })

    it('loading 期间重复 startExport / retry 被忽略（防重入，无并发取数）', async () => {
        const { api, list } = setup(async () => pageOf([]))

        const first = api.startExport()
        const second = api.startExport()
        const third = api.retry()
        await Promise.all([first, second, third])

        expect(api.status.value).toBe('ready')
        expect(list).toHaveBeenCalledTimes(1)
    })

    it('成功后缓存任务树：ready 期间不重复取数', async () => {
        const { api, list } = setup(async () => pageOf([]))

        await api.startExport()
        expect(list).toHaveBeenCalledTimes(1)

        // 格式切换为本地重渲染，不触碰取数；此处以「无进一步调用」验证缓存不被无端失效
        await Promise.resolve()
        expect(list).toHaveBeenCalledTimes(1)
        expect(api.status.value).toBe('ready')
    })

    it('reset ⇒ 回 idle 并清空错误与三格式缓存（关框语义）', async () => {
        const { api } = setup(async () => pageOf([]))

        await api.startExport()
        expect(api.status.value).toBe('ready')

        api.reset()

        expect(api.status.value).toBe('idle')
        expect(api.error.value).toBe('')
        expect(api.markdown.value).toBe('')
        expect(api.json.value).toBe('')
        expect(api.html.value).toBe('')
    })
})