// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { nextTick } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { CALENDAR_SORT_STORAGE_KEY } from './calendar-sort'
import { useCalendarSort } from './use-calendar-sort'

/**
 * TASK-08 日历排序组合式
 * @description 排序状态经 localStorage 独立键持久化（月/周双视图共享同一实例）；
 *              默认未选字段 = 名称升序；变更即写回；sortTasks 按当前排序重排（不改原快照）。
 */

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        name: '任务',
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: '',
        createdAt: '2026-10-01T00:00:00',
        ...overrides
    }) as unknown as TaskViewObject

beforeEach(() => {
    localStorage.clear()
})

describe('useCalendarSort - 状态与持久化', () => {
    it('默认状态 = 未选字段（按名称升序），不写入存储', () => {
        const { sort } = useCalendarSort()
        expect(sort.value).toEqual({ order: 'asc' })
        expect(localStorage.getItem(CALENDAR_SORT_STORAGE_KEY)).toBeNull()
    })

    it('选择字段/方向后写回独立键（双视图共享同一状态源）', async () => {
        const { sort } = useCalendarSort()
        sort.value = { field: 'priority', order: 'desc' }
        await nextTick()
        expect(localStorage.getItem(CALENDAR_SORT_STORAGE_KEY)).toBe(
            JSON.stringify({ field: 'priority', order: 'desc' })
        )
    })

    it('回退到默认（field 置空）→ 存储同步清空字段位', async () => {
        const { sort } = useCalendarSort()
        sort.value = { field: 'startAt', order: 'asc' }
        sort.value = { order: 'asc' }
        await nextTick()
        expect(JSON.parse(localStorage.getItem(CALENDAR_SORT_STORAGE_KEY)!)).toEqual({
            order: 'asc'
        })
    })

    it('预先持久化状态 → 挂载即回读（跨会话/月周切换记忆）', () => {
        localStorage.setItem(
            CALENDAR_SORT_STORAGE_KEY,
            JSON.stringify({ field: 'createdAt', order: 'desc' })
        )
        const { sort } = useCalendarSort()
        expect(sort.value).toEqual({ field: 'createdAt', order: 'desc' })
    })
})

describe('useCalendarSort - sortTasks 展示排序', () => {
    it('未选字段 → 名称升序；选择字段后按字段×方向', () => {
        const { sort, sortTasks } = useCalendarSort()
        const tasks = [
            makeTask({ id: 'high', name: '高', priority: 'high' }),
            makeTask({ id: 'low', name: '低', priority: 'low' })
        ]
        expect(sortTasks(tasks).map((t) => t.id)).toEqual(['low', 'high'])

        sort.value = { field: 'priority', order: 'desc' }
        expect(sortTasks(tasks).map((t) => t.id)).toEqual(['high', 'low'])
    })

    it('不改动原快照（拖拽改期后仍按当前排序重排，无 sortId 残留）', () => {
        const { sort, sortTasks } = useCalendarSort()
        const tasks = [
            makeTask({ id: 'b', name: 'B', priority: 'high' }),
            makeTask({ id: 'a', name: 'A', priority: 'low' })
        ]
        const before = [...tasks]
        sort.value = { field: 'priority', order: 'desc' }
        const sorted = sortTasks(tasks)
        expect(sorted).not.toBe(tasks)
        expect(tasks).toEqual(before)
        expect(sorted.map((t) => t.id)).toEqual(['b', 'a'])
    })
})