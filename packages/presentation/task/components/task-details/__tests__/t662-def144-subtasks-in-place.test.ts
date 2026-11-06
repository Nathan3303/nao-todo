// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick, ref } from 'vue'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTaskDetailsStore } from '../../../stores'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from '../context'
import useSubTasks from '../use-subtasks'

/**
 * `T662` / `DEF-144`（子任务区同族）—— `RefreshData` 触发的子任务重载必须**原地**进行
 *
 * @description 旧实现：`onRefresh` → `retrySubTasks` → `loadSubTasks`（先 `taskIds.clear()` +
 *              置 `subTasksLoading`）⇒ 每轮自动刷新（30s）子任务区整块变加载态（闪动），
 *              且「新增子任务」输入框（`InputButton`）随 `v-if` 卸载 ⇒ 未提交文字丢失。
 *              现实现：`RefreshData` 走 `refreshSubTasksInPlace`（不置 loading、不清空、成功后整体替换）；
 *              首次进入 / 切换任务仍走 `loadSubTasks`（必须显示 loading）。
 */

const PARENT_ID = 'parent-1'

const flush = async (): Promise<void> => {
    for (let i = 0; i < 6; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

const makeSubTask = (id: string, sortId: number): TaskViewObject =>
    ({ id, parentTaskId: PARENT_ID, name: id, sortId, tags: [], remindWeekdays: [] }) as never

let wrappers: VueWrapper[] = []

const setup = () => {
    setActivePinia(createPinia())
    const store = useTaskDetailsStore()
    const handlers: { refresh: (() => void) | null } = { refresh: null }
    const subscriber = {
        emit: vi.fn(),
        subscribe: (event: string, cb: () => void) => {
            if (event === 'RefreshData') handlers.refresh = cb
        },
        unsubscribe: vi.fn()
    }
    let nextIds = ['s1', 's2']
    const list = vi.fn(async () => [
        {
            taskIds: [...nextIds],
            pagination: { total: nextIds.length, page: 1, limit: 100, maxPage: 1 }
        },
        null
    ])
    const subTaskUseCase = { list } as unknown as TaskUseCase

    let api: ReturnType<typeof useSubTasks> | null = null
    const wrapper = mount(
        defineComponent({
            setup() {
                api = useSubTasks(store, ref(null))
                return () => null
            }
        }),
        {
            global: {
                provide: {
                    [TASK_DETAILS_PRE_CONTEXT_KEY as symbol]: { subTaskUseCase, subscriber }
                }
            }
        }
    )
    wrappers.push(wrapper)
    return {
        api: api!,
        store,
        list,
        refresh: () => handlers.refresh?.(),
        setNextIds: (ids: string[]) => {
            nextIds = ids
        }
    }
}

beforeEach(() => {
    wrappers = []
})

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('T662 / DEF-144 · 子任务区的 RefreshData 原地刷新', () => {
    it('首次加载仍显示 loading（不得“永不显示 loading”）', async () => {
        const { api, store } = setup()
        store.addTask(makeSubTask('s1', 1000))
        store.addTask(makeSubTask('s2', 2000))
        const pending = api.loadSubTasks(PARENT_ID)
        // 同步点采样：`loadSubTasks` 在 await 之前即置 loading
        expect(api.subTasksLoading.value).toBe(true)
        await pending
        await flush()
        expect(api.subTasksLoading.value).toBe(false)
        expect(api.subTasks.value.map((task) => task.id)).toEqual(['s1', 's2'])
    })

    it('RefreshData 重载：loading 保持 false、已渲染行不被清空，成功后整体替换', async () => {
        const { api, store, setNextIds, refresh } = setup()
        await api.loadSubTasks(PARENT_ID)
        await flush()
        // 子任务内容写进 details store（view 侧从 store 取对象）
        store.addTask(makeSubTask('s1', 1000))
        store.addTask(makeSubTask('s2', 2000))
        await flush()
        expect(api.subTasks.value).toHaveLength(2)

        setNextIds(['s1', 's2', 's3'])
        store.addTask(makeSubTask('s3', 3000))
        refresh()
        // 在飞期间（list 是立即 resolve 的 async，仍先采一次同步点）
        expect(api.subTasksLoading.value, '刷新不得把子任务区换成加载态').toBe(false)
        await flush()
        expect(api.subTasksLoading.value).toBe(false)
        expect(api.subTasks.value.map((task) => task.id)).toEqual(['s1', 's2', 's3'])
    })
})