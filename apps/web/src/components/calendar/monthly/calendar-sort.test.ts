import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    CALENDAR_SORT_STORAGE_KEY,
    readCalendarSort,
    sortCalendarTasks,
    writeCalendarSort,
    type CalendarSort,
    type CalendarSortStorage
} from './calendar-sort'

/**
 * TASK-08 日历排序纯逻辑
 * @description 四项字段（优先级/开始/截止/创建）× 升降序；未选字段=默认按名称升序（localeCompare）；
 *              缺失/无效时间恒排末尾（升降序一致）；localStorage 独立键读写容错。
 */

/** 最小任务快照构造（仅涉及排序字段；其余字段用 as unknown 兜底） */
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

const ids = (tasks: TaskViewObject[]): string[] => tasks.map((task) => task.id)

const makeStorage = (initial: Record<string, string> = {}): CalendarSortStorage => {
    const map = new Map(Object.entries(initial))
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => {
            map.set(key, value)
        }
    }
}

describe('sortCalendarTasks - 默认名称升序（未选字段）', () => {
    it('无字段 → 名称 localeCompare 升序（中文/含前缀混合）', () => {
        const tasks = [
            makeTask({ id: 'w', name: '王五' }),
            makeTask({ id: 'z', name: '张三' }),
            makeTask({ id: 'l', name: '李四' }),
            makeTask({ id: 'b', name: '任务B' }),
            makeTask({ id: 'a', name: '任务A' })
        ]
        const sorted = sortCalendarTasks(tasks, { order: 'asc' })
        expect(ids(sorted)).toEqual(['l', 'a', 'b', 'w', 'z'])
    })

    it('同名/空名 → 按 id 稳定兜底', () => {
        const tasks = [
            makeTask({ id: 'b', name: '同名' }),
            makeTask({ id: 'a', name: '同名' }),
            makeTask({ id: 'c', name: '' })
        ]
        expect(ids(sortCalendarTasks(tasks, { order: 'asc' }))).toEqual(['c', 'a', 'b'])
    })

    it('返回新数组且不改动原快照（不触达 sortId/服务端）', () => {
        const tasks = [makeTask({ id: 'b', name: 'B' }), makeTask({ id: 'a', name: 'A' })]
        const before = tasks.map((t) => ({ ...t }))
        const sorted = sortCalendarTasks(tasks, { order: 'asc' })
        expect(sorted).not.toBe(tasks)
        expect(ids(sorted)).toEqual(['a', 'b'])
        expect(tasks).toEqual(before)
    })
})

describe('sortCalendarTasks - 优先级', () => {
    it('升序：低 → 中 → 高', () => {
        const tasks = [
            makeTask({ id: 'high', priority: 'high' }),
            makeTask({ id: 'low', priority: 'low' }),
            makeTask({ id: 'mid', priority: 'medium' })
        ]
        expect(ids(sortCalendarTasks(tasks, { field: 'priority', order: 'asc' }))).toEqual([
            'low',
            'mid',
            'high'
        ])
    })

    it('降序：高 → 中 → 低', () => {
        const tasks = [
            makeTask({ id: 'low', priority: 'low' }),
            makeTask({ id: 'high', priority: 'high' }),
            makeTask({ id: 'mid', priority: 'medium' })
        ]
        expect(ids(sortCalendarTasks(tasks, { field: 'priority', order: 'desc' }))).toEqual([
            'high',
            'mid',
            'low'
        ])
    })

    it('未知优先级权重按 0 处理（与 low 同档；同档回落名称升序）', () => {
        const tasks = [
            makeTask({ id: 'z', priority: 'urgent', name: 'z' }),
            makeTask({ id: 'a', priority: 'urgent', name: 'a' }),
            makeTask({ id: 'h', priority: 'high', name: 'h' })
        ]
        expect(ids(sortCalendarTasks(tasks, { field: 'priority', order: 'asc' }))).toEqual([
            'a',
            'z',
            'h'
        ])
    })
})

describe('sortCalendarTasks - 时间字段（开始/截止/创建）', () => {
    it('startAt 升序按时间；缺失/空值恒排末尾（升序时也靠后）', () => {
        const tasks = [
            makeTask({ id: 'none', startAt: null }),
            makeTask({ id: 'later', startAt: '2026-10-03T09:00:00' }),
            makeTask({ id: 'empty', startAt: '' }),
            makeTask({ id: 'earlier', startAt: '2026-10-01T09:00:00' })
        ]
        const sorted = sortCalendarTasks(tasks, { field: 'startAt', order: 'asc' })
        // 缺失/空值同为 null → 回落名称升序
        expect(ids(sorted)).toEqual(['earlier', 'later', 'empty', 'none'])
    })

    it('startAt 降序按时间倒排；缺失值仍恒排末尾（不因降序前置）', () => {
        const tasks = [
            makeTask({ id: 'none', startAt: null }),
            makeTask({ id: 'later', startAt: '2026-10-03T09:00:00' }),
            makeTask({ id: 'earlier', startAt: '2026-10-01T09:00:00' })
        ]
        expect(ids(sortCalendarTasks(tasks, { field: 'startAt', order: 'desc' }))).toEqual([
            'later',
            'earlier',
            'none'
        ])
    })

    it('endAt 升降序按时间；非法日期按缺失处理', () => {
        const tasks = [
            makeTask({ id: 'invalid', endAt: 'not-a-date' }),
            makeTask({ id: 'later', endAt: '2026-10-05T18:00:00' }),
            makeTask({ id: 'earlier', endAt: '2026-10-02T18:00:00' })
        ]
        expect(ids(sortCalendarTasks(tasks, { field: 'endAt', order: 'asc' }))).toEqual([
            'earlier',
            'later',
            'invalid'
        ])
        expect(ids(sortCalendarTasks(tasks, { field: 'endAt', order: 'desc' }))).toEqual([
            'later',
            'earlier',
            'invalid'
        ])
    })

    it('createdAt 升序按创建先后', () => {
        const tasks = [
            makeTask({ id: 'c3', createdAt: '2026-10-03T00:00:00' }),
            makeTask({ id: 'c1', createdAt: '2026-10-01T00:00:00' }),
            makeTask({ id: 'c2', createdAt: '2026-10-02T00:00:00' })
        ]
        expect(ids(sortCalendarTasks(tasks, { field: 'createdAt', order: 'asc' }))).toEqual([
            'c1',
            'c2',
            'c3'
        ])
        expect(ids(sortCalendarTasks(tasks, { field: 'createdAt', order: 'desc' }))).toEqual([
            'c3',
            'c2',
            'c1'
        ])
    })

    it('字段值相同 → 回落名称升序（稳定可断言）', () => {
        const tasks = [
            makeTask({ id: 'z', startAt: '2026-10-01T09:00:00', name: 'zzz' }),
            makeTask({ id: 'a', startAt: '2026-10-01T09:00:00', name: 'aaa' })
        ]
        expect(ids(sortCalendarTasks(tasks, { field: 'startAt', order: 'desc' }))).toEqual([
            'a',
            'z'
        ])
    })
})

describe('readCalendarSort / writeCalendarSort - 独立键持久化与容错', () => {
    it('空存储 / 存储不可用（null）→ 默认 { order: asc }（field 缺省）', () => {
        expect(readCalendarSort(makeStorage())).toEqual({ order: 'asc' })
        expect(readCalendarSort(null)).toEqual({ order: 'asc' })
    })

    it('损坏 JSON / 非对象 → 回退默认', () => {
        expect(readCalendarSort(makeStorage({ [CALENDAR_SORT_STORAGE_KEY]: 'not-json{' }))).toEqual(
            { order: 'asc' }
        )
        expect(readCalendarSort(makeStorage({ [CALENDAR_SORT_STORAGE_KEY]: '"str"' }))).toEqual({
            order: 'asc'
        })
    })

    it('非法字段丢弃、合法顺序保留；非法顺序回退 asc', () => {
        const storage = makeStorage({
            [CALENDAR_SORT_STORAGE_KEY]: JSON.stringify({ field: 'name', order: 'desc' })
        })
        expect(readCalendarSort(storage)).toEqual({ order: 'desc' })
        expect(
            readCalendarSort(
                makeStorage({
                    [CALENDAR_SORT_STORAGE_KEY]: JSON.stringify({ field: 'priority', order: 'up' })
                })
            )
        ).toEqual({ field: 'priority', order: 'asc' })
    })

    it('合法状态完整回读（含四项字段）', () => {
        const values: CalendarSort[] = [
            { field: 'priority', order: 'desc' },
            { field: 'startAt', order: 'asc' },
            { field: 'endAt', order: 'desc' },
            { field: 'createdAt', order: 'asc' }
        ]
        for (const value of values) {
            const storage = makeStorage()
            writeCalendarSort(value, storage)
            expect(readCalendarSort(storage)).toEqual(value)
        }
    })

    it('写入走独立日历键（不与任务列表 getTasksOptions.sort 串扰）', () => {
        const storage = makeStorage()
        writeCalendarSort({ field: 'priority', order: 'desc' }, storage)
        expect(storage.getItem(CALENDAR_SORT_STORAGE_KEY)).toBe(
            JSON.stringify({ field: 'priority', order: 'desc' })
        )
        // 键名即独立日历排序键常量
        expect(CALENDAR_SORT_STORAGE_KEY).toBe('naotodo.calendar.sort')
    })

    it('存储 getItem/setItem 抛错 → 静默降级不抛', () => {
        const throwing: CalendarSortStorage = {
            getItem: () => {
                throw new Error('denied')
            },
            setItem: () => {
                throw new Error('denied')
            }
        }
        expect(readCalendarSort(throwing)).toEqual({ order: 'asc' })
        expect(() => writeCalendarSort({ field: 'priority', order: 'asc' }, throwing)).not.toThrow()
    })
})