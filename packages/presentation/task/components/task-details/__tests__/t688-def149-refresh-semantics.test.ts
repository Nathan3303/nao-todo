// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, ref } from 'vue'
import type { TaskUseCase } from '@nao-todo/domain-task'
import { useTaskDetailsStore } from '../../../stores'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import type { TaskDetailsViewObject } from '../types'
import useSubTasks from '../use-subtasks'

/**
 * T688 / `DEF-149` —— **子任务刷新失败的分流语义**（composable 级，真实 store + 真实 loader）
 *
 * - 有已渲染行 ⇒ 只落**非阻塞** `refreshError`（`subTasksError` 保持空 ⇒ 视图不换内容、不卸载输入框）；
 * - 无内容可保（0 条）⇒ 仍落**阻塞式** `subTasksError`（不吞真错误）；
 * - 刷新成功 ⇒ 清掉 `refreshError` 与残留阻塞错误（不刷屏）。
 */

let wrappers: VueWrapper[] = []

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers = []
})

const flush = async (): Promise<void> => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve()
}

interface SetupResult {
    api: ReturnType<typeof useSubTasks>
    refresh: () => Promise<void>
}

const setup = (list: ReturnType<typeof vi.fn>): SetupResult => {
    setActivePinia(createPinia())
    const store = useTaskDetailsStore()
    const parentTask = ref<TaskDetailsViewObject | null>(null)
    let onRefresh: (() => void) | null = null
    const subTaskUseCase = { list, create: vi.fn() } as unknown as TaskUseCase
    let api: ReturnType<typeof useSubTasks> | null = null
    const wrapper = mount(
        defineComponent({
            setup() {
                api = useSubTasks(store, parentTask)
                return () => null
            }
        }),
        {
            global: {
                provide: {
                    [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: {
                        subTaskUseCase,
                        subscriber: {
                            emit: vi.fn(),
                            subscribe: (event: string, handler: () => void) => {
                                if (event === 'RefreshData') onRefresh = handler
                            },
                            unsubscribe: vi.fn()
                        }
                    }
                }
            }
        }
    )
    wrappers.push(wrapper)
    return {
        api: api!,
        refresh: async () => {
            onRefresh?.()
            await flush()
        }
    }
}

const pageOf = (taskIds: string[]) => [
    { taskIds, pagination: { total: taskIds.length, page: 1, limit: 100, maxPage: 1 } },
    null
]

describe('T688 / DEF-149 刷新失败分流（有内容 ⇒ 非阻塞；无内容 ⇒ 阻塞）', () => {
    beforeEach(() => vi.clearAllMocks())

    it('有已渲染行 + 刷新失败 ⇒ 非阻塞 refreshError，阻塞错误保持空（内容不被替换）', async () => {
        const list = vi
            .fn()
            .mockResolvedValueOnce(pageOf(['a', 'b']))
            .mockResolvedValueOnce([null, '网络异常'])
        const { api, refresh } = setup(list)

        await api.loadSubTasks('parent-1')
        expect(api.subTasksError.value).toBe('')
        expect(api.subTasksRefreshError.value).toBeNull()

        await refresh()

        expect(api.subTasksRefreshError.value).toBe('网络异常')
        // 关键：**不落阻塞错误**（视图因此保留行与输入框）
        expect(api.subTasksError.value).toBe('')
    })

    it('无内容可保（0 条）+ 刷新失败 ⇒ 仍落阻塞错误（不得静默）', async () => {
        const list = vi
            .fn()
            .mockResolvedValueOnce(pageOf([]))
            .mockResolvedValueOnce([null, '网络异常'])
        const { api, refresh } = setup(list)

        await api.loadSubTasks('parent-1')
        await refresh()

        expect(api.subTasksError.value).toContain('子任务获取失败')
        expect(api.subTasksRefreshError.value).toBeNull()
    })

    it('刷新成功 ⇒ 非阻塞提示消除（不刷屏）', async () => {
        const list = vi
            .fn()
            .mockResolvedValueOnce(pageOf(['a']))
            .mockResolvedValueOnce([null, '网络异常'])
            .mockResolvedValueOnce(pageOf(['a']))
        const { api, refresh } = setup(list)

        await api.loadSubTasks('parent-1')
        await refresh()
        expect(api.subTasksRefreshError.value).toBe('网络异常')

        await refresh()
        expect(api.subTasksRefreshError.value).toBeNull()
        expect(api.subTasksError.value).toBe('')
    })
})