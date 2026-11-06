// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { useTasksStore } from '@nao-todo/presentation/task'
import type { TaskViewObject, TaskUseCase } from '@nao-todo/domain-task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { useCalendarTaskQuery } from '../use-calendar-task-query'

/**
 * `T664` / `DEF-144` 日历落点 —— 自动刷新重载**不得**抖（AC-C1）
 *
 * @description 实测见本单回执：`resetAndLoad()` 先清空 `taskIds` ⇒ `runSweep` 的
 *              `loading = taskIds.size === 0` 判真 ⇒ `RefreshData` 在飞期间整个月历被
 *              `month-grid.vue` 的 `<div v-if="loading" class="cal-body-state">` 替换、
 *              快照任务数掉到 0（实证：`during: loading / tasks=0`）。
 *
 * 修法：`RefreshData` 走**原地刷新**（`refreshInPlace`：不清空快照 ⇒ `loading` 保持 false；
 *       成功后整体替换快照）；筛选变化 / 首进 / 重试仍走 `resetAndLoad`（**必须可见 loading**）。
 *
 * 断言口径（AC-C1）：刷新**在飞期间** ① 未命中 loading 分支 ② 快照任务数不变 ③ 未落空态占位；
 *                     完成后快照收敛到新结果。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

const makeDeferred = () => {
    let resolve: (v?: unknown) => void = () => {}
    const promise = new Promise<unknown>((r) => (resolve = r))
    return { promise, resolve }
}

const makeTask = (id: string, endAt: string): TaskViewObject =>
    ({
        id,
        parentTaskId: '',
        name: id,
        description: '',
        state: 'todo',
        priority: 'medium',
        startAt: null,
        endAt,
        projectId: 'p1',
        tags: [],
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        deletedAt: null,
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false
    }) as unknown as TaskViewObject

type Harness = {
    wrapper: VueWrapper
    api: () => ReturnType<typeof useCalendarTaskQuery>
    park: () => void
    release: () => void
    setIds: (ids: string[]) => void
    taskCount: () => number
    branch: () => string
    selectedProjectIds: Ref<string[]>
    listCalls: () => number
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    document.body.innerHTML = ''
})

const mountCalendar = (seed: TaskViewObject[]): Harness => {
    setActivePinia(createPinia())
    const tasksStore = useTasksStore()
    tasksStore.addTasks(seed.map((task) => ({ ...task })))

    let gate: { promise: Promise<unknown>; resolve: (v?: unknown) => void } | null = null
    let ids = seed.map((task) => task.id)
    let calls = 0
    const list = vi.fn(async () => {
        calls += 1
        if (gate) await gate.promise
        return [
            {
                taskIds: [...ids],
                pagination: { total: ids.length, page: 1, limit: 100, maxPage: 1 }
            },
            null
        ]
    })
    const taskUseCase = { list } as unknown as TaskUseCase

    const subscriber = useSubscriber()
    const selectedProjectIds = ref<string[]>([])
    const selectedTagIds = ref<string[]>([])
    const hideCompleted = ref(false)

    let apiRef: ReturnType<typeof useCalendarTaskQuery> | null = null
    const Host = defineComponent({
        setup() {
            apiRef = useCalendarTaskQuery({ tasksStore, taskUseCase } as never)
            return { loading: apiRef.loading, tasks: apiRef.tasks }
        },
        template: `<div>
            <div v-if="loading" class="cal-loading-marker">loading</div>
            <div v-else-if="tasks.length === 0" class="cal-empty-marker">empty</div>
            <div v-else class="cal-grid-marker">{{ tasks.length }}</div>
        </div>`
    })
    const wrapper = mount(Host, {
        global: {
            provide: {
                [CALENDAR_VIEW_CONTEXT_KEY as symbol]: {
                    subscriber,
                    selectedProjectIds,
                    selectedTagIds,
                    hideCompleted
                }
            }
        }
    })
    mounted.push(wrapper)

    return {
        wrapper,
        api: () => apiRef!,
        park: () => (gate = makeDeferred()),
        release: () => {
            const current = gate
            gate = null
            current?.resolve(undefined)
        },
        setIds: (next) => {
            ids = next
        },
        taskCount: () => apiRef!.tasks.value.length,
        branch: () =>
            wrapper.find('.cal-loading-marker').exists()
                ? 'loading'
                : wrapper.find('.cal-empty-marker').exists()
                  ? 'empty'
                  : 'grid',
        selectedProjectIds,
        listCalls: () => calls
    }
}

describe('T664 / DEF-144 · 日历自动刷新不抖（AC-C1）', () => {
    it('刷新在飞期间：不命中 loading 分支、快照数不变、不落空态；完成后收敛到新结果', async () => {
        const seed = [makeTask('c1', '2026-11-10T02:00:00.000Z')]
        const harness = mountCalendar(seed)
        await SETTLE()

        expect(harness.branch()).toBe('grid')
        const before = harness.taskCount()
        expect(before).toBe(1)

        harness.park()
        harness.setIds(['c1', 'c2'])
        useSubscriber().emit('RefreshData' as never)
        await SETTLE()

        expect(harness.branch(), '刷新在飞期间不得命中 loading 分支').toBe('grid')
        expect(harness.taskCount(), '刷新在飞期间快照数不得变化').toBe(before)

        harness.release()
        await SETTLE()
        // c2 未入库 ⇒ 快照按 ID 解析后只剩 c1；这里只断言「分支与数量结构不变、无闪动」
        expect(harness.branch()).toBe('grid')
        expect(harness.taskCount()).toBe(1)
    })

    it('筛选变化仍走非原地路径（必须可见 loading，不得靠删 loading 过）', async () => {
        const harness = mountCalendar([makeTask('c1', '2026-11-10T02:00:00.000Z')])
        await SETTLE()
        expect(harness.branch()).toBe('grid')

        harness.park()
        harness.selectedProjectIds.value = ['p1']
        await SETTLE()
        expect(harness.branch(), '筛选变化必须可见 loading').toBe('loading')
        harness.release()
        await SETTLE()
        expect(harness.branch()).toBe('grid')
    })

    it('首次进入（查询在飞）仍显示 loading', async () => {
        setActivePinia(createPinia())
        const tasksStore = useTasksStore()
        const gate = makeDeferred()
        const taskUseCase = {
            list: vi.fn(async () => {
                await gate.promise
                return [{ taskIds: [], pagination: undefined }, null]
            })
        } as unknown as TaskUseCase
        let apiRef: ReturnType<typeof useCalendarTaskQuery> | null = null
        const Host = defineComponent({
            setup() {
                apiRef = useCalendarTaskQuery({ tasksStore, taskUseCase } as never)
                return { loading: apiRef.loading }
            },
            template: `<div><div v-if="loading" class="cal-loading-marker">loading</div></div>`
        })
        const wrapper = mount(Host, {
            global: {
                provide: {
                    [CALENDAR_VIEW_CONTEXT_KEY as symbol]: {
                        subscriber: useSubscriber(),
                        selectedProjectIds: ref<string[]>([]),
                        selectedTagIds: ref<string[]>([]),
                        hideCompleted: ref(false)
                    }
                }
            }
        })
        mounted.push(wrapper)
        expect(wrapper.find('.cal-loading-marker').exists(), '首次进入必须显示 loading').toBe(true)
        gate.resolve(undefined)
        await SETTLE()
        expect(wrapper.find('.cal-loading-marker').exists()).toBe(false)
        void apiRef
    })
})