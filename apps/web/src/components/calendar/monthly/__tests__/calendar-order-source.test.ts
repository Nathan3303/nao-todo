// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, ref, shallowRef } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { CALENDAR_SORT_STORAGE_KEY } from '../calendar-sort'
import useCalendarMonthly from '../use-calendar-monthly'

/**
 * T45 独立复核：AC2 四处顺序同源（补 rd-fe 遗留的日内抽屉 + 未安排列表组合式单测）
 * @description 通过最小注入（CalendarViewContext + Pinia + mock useTaskUseCase）挂载
 *              `useCalendarMonthly`，直接断言：
 *              - `getDayTasks`（日内抽屉）顺序 = 用户排序（旧实现为「开始时间→创建时间」）；
 *              - `unscheduledTasks`（未安排）顺序 = 用户排序（旧实现为 `createdAt desc`）；
 *              - 默认（未选字段）= 名称升序。
 *              任务刻意构造为「用户排序顺序」与「旧隐藏排序顺序」相反，以具备判别力。
 */

const hoisted = vi.hoisted(() => ({ taskIds: [] as string[] }))

vi.mock('@/hooks', () => ({
    useTaskUseCase: () => ({
        list: vi.fn(async () => [
            {
                taskIds: hoisted.taskIds,
                pagination: {
                    total: hoisted.taskIds.length,
                    page: 1,
                    limit: 100,
                    maxPage: 1
                }
            },
            null
        ])
    })
}))

const makeTask = (input: {
    id: string
    name: string
    priority: TaskViewObject['priority']
    startAt: string | null
    endAt: string | null
    createdAt: string
}): TaskViewObject =>
    ({
        id: input.id,
        name: input.name,
        state: 'todo',
        priority: input.priority,
        startAt: input.startAt,
        endAt: input.endAt,
        createdAt: input.createdAt,
        tags: []
    }) as unknown as TaskViewObject

// A/B 整周；C 周一全天；D 周一至周四；E/F 未安排（endAt 为空）
// createdAt 刻意与「用户排序（优先级降序 + 名称升序）」相反，用于识破旧隐藏排序
const TASKS: TaskViewObject[] = [
    makeTask({
        id: 'a',
        name: 'A',
        priority: 'high',
        startAt: '2026-09-21 00:00:00',
        endAt: '2026-09-27 00:00:00',
        createdAt: '2026-09-10 00:00:00' // 最新
    }),
    makeTask({
        id: 'b',
        name: 'B',
        priority: 'medium',
        startAt: '2026-09-21 00:00:00',
        endAt: '2026-09-27 00:00:00',
        createdAt: '2026-09-01 00:00:00' // 最早
    }),
    makeTask({
        id: 'c',
        name: 'C',
        priority: 'high',
        startAt: '2026-09-21 00:00:00',
        endAt: '2026-09-21 00:00:00',
        createdAt: '2026-09-05 00:00:00'
    }),
    makeTask({
        id: 'd',
        name: 'D',
        priority: 'low',
        startAt: '2026-09-21 00:00:00',
        endAt: '2026-09-24 00:00:00',
        createdAt: '2026-09-03 00:00:00'
    }),
    makeTask({
        id: 'e',
        name: 'E',
        priority: 'high',
        startAt: null,
        endAt: null,
        createdAt: '2026-09-02 00:00:00' // 未安排中较早
    }),
    makeTask({
        id: 'f',
        name: 'F',
        priority: 'low',
        startAt: null,
        endAt: null,
        createdAt: '2026-09-09 00:00:00' // 未安排中较晚
    })
]

const buildContext = () => ({
    dialogManager: { open: vi.fn() },
    subscriber: { subscribe: vi.fn(), unsubscribe: vi.fn(), emit: vi.fn() },
    isDisplayAside: ref(false),
    isUseFloatAside: ref(false),
    switchDisplayAside: vi.fn(),
    showTaskDetails: vi.fn(),
    selectedProjectIds: ref<string[]>([]),
    selectedTagIds: ref<string[]>([]),
    hideCompleted: ref(false),
    weekStart: ref<'sunday' | 'monday'>('monday'),
    setWeekStart: vi.fn(),
    pomodoroBadge: ref(true),
    setPomodoroBadge: vi.fn(),
    clearFilter: vi.fn(),
    applyScope: vi.fn()
})

const mountMonthly = () => {
    setActivePinia(createPinia())
    useTasksStore().addTasks(TASKS)
    hoisted.taskIds = TASKS.map((t) => t.id)

    const result = shallowRef<ReturnType<typeof useCalendarMonthly> | null>(null)
    const wrapper = mount(
        defineComponent({
            setup() {
                result.value = useCalendarMonthly()
                return () => null
            }
        }),
        {
            global: {
                provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext() }
            }
        }
    )
    return { wrapper, result }
}

beforeEach(() => {
    localStorage.clear()
})

describe('T45-AC2 日内抽屉 getDayTasks 顺序同源用户排序', () => {
    it('优先级降序：同日 4 条按 高(A,C) → 中(B) → 低(D)，而非旧「开始时间→创建时间」序', async () => {
        localStorage.setItem(
            CALENDAR_SORT_STORAGE_KEY,
            JSON.stringify({ field: 'priority', order: 'desc' })
        )
        const { wrapper, result } = mountMonthly()
        await flushPromises()

        const names = result.value!.getDayTasks('2026-09-21').map((t) => t.name)
        // 旧隐藏排序（startAt 相同 → createdAt asc）会得到 [B,D,C,A]
        expect(names).toEqual(['A', 'C', 'B', 'D'])
        expect(names).not.toEqual(['B', 'D', 'C', 'A'])
        wrapper.unmount()
    })

    it('默认（未选字段）：日内抽屉按名称升序', async () => {
        const { wrapper, result } = mountMonthly()
        await flushPromises()

        expect(result.value!.getDayTasks('2026-09-21').map((t) => t.name)).toEqual([
            'A',
            'B',
            'C',
            'D'
        ])
        wrapper.unmount()
    })
})

describe('T45-AC2 未安排列表 unscheduledTasks 顺序同源用户排序', () => {
    it('优先级降序：高(E) 在 低(F) 之前，而非旧 createdAt desc（F 在前）', async () => {
        localStorage.setItem(
            CALENDAR_SORT_STORAGE_KEY,
            JSON.stringify({ field: 'priority', order: 'desc' })
        )
        const { wrapper, result } = mountMonthly()
        await flushPromises()

        const names = result.value!.unscheduledTasks.value.map((t) => t.name)
        expect(names).toEqual(['E', 'F'])
        expect(names).not.toEqual(['F', 'E'])
        wrapper.unmount()
    })

    it('默认（未选字段）：未安排按名称升序', async () => {
        const { wrapper, result } = mountMonthly()
        await flushPromises()

        expect(result.value!.unscheduledTasks.value.map((t) => t.name)).toEqual(['E', 'F'])
        wrapper.unmount()
    })
})

describe('T45-AC5 排序偏好损坏 ⇒ 回退默认名称升序且不抛错', () => {
    it('localStorage 非法 JSON：日内抽屉/未安排均按名称升序', async () => {
        localStorage.setItem(CALENDAR_SORT_STORAGE_KEY, '{not valid json')
        const { wrapper, result } = mountMonthly()
        await flushPromises()

        expect(result.value!.getDayTasks('2026-09-21').map((t) => t.name)).toEqual([
            'A',
            'B',
            'C',
            'D'
        ])
        expect(result.value!.unscheduledTasks.value.map((t) => t.name)).toEqual(['E', 'F'])
        wrapper.unmount()
    })
})

describe('T45-AC2 月格轨道序与日内抽屉同源（同一 sortedTasks 前缀）', () => {
    it('同日覆盖任务在月模型轨道序 = getDayTasks 序（均源自用户排序）', async () => {
        localStorage.setItem(
            CALENDAR_SORT_STORAGE_KEY,
            JSON.stringify({ field: 'priority', order: 'desc' })
        )
        const { wrapper, result } = mountMonthly()
        await flushPromises()

        const dayOrder = result.value!.getDayTasks('2026-09-21').map((t) => t.name)
        const row = result.value!.model.value.rows.find((r) => r.segments.length >= 4)!
        const laneOrder = [...row.segments].sort((a, b) => a.lane - b.lane).map((s) => s.task.name)
        // 月模型按 colStart 分组，A/B/C/D 均 colStart=0，组内保持传入（用户）序
        expect(laneOrder).toEqual(['A', 'C', 'B', 'D'])
        expect(laneOrder).toEqual(dayOrder)
        wrapper.unmount()
    })
})