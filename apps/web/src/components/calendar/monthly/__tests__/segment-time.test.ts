import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { showEndTimeInMonth, showEndTimeInWeek } from '../segment-time'
import type { CalendarDayCell, CalendarRow, CalendarSegment } from '../monthly-layout'

/**
 * 段末截止时刻可见性（TASK-11）
 * @description 由「段首开始时刻」改为「段末截止时刻」：仅真末段可见，
 *              月视图额外要求末段结束格 = endAt 当日；跨行续接/裁剪段不显示。
 */

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        name: '任务',
        state: 'todo',
        priority: 'low',
        startAt: '2026-10-05T09:00:00',
        endAt: '2026-10-07T18:00:00',
        createdAt: '2026-10-01T00:00:00',
        ...overrides
    }) as unknown as TaskViewObject

const makeSeg = (overrides: Partial<CalendarSegment> = {}): CalendarSegment => ({
    task: makeTask(),
    colStart: 0,
    colEnd: 2,
    lane: 0,
    isStart: true,
    isEnd: true,
    ...overrides
})

const makeCell = (dateKey: string, cell: number): CalendarDayCell => ({
    cell,
    dateKey,
    day: Number(dateKey.slice(-2)),
    monthOffset: 0,
    isToday: false,
    isSelected: false,
    isWeekend: false
})

const makeRow = (dateKeys: string[]): CalendarRow => ({
    row: 0,
    cells: dateKeys.map((key, i) => makeCell(key, i)),
    segments: [],
    overflow: []
})

describe('showEndTimeInMonth - 月视图段末截止时刻', () => {
    // 2026-10-05(周一) 起 2026-10-07(周三) 止；末段 colEnd=2 对应 10-07
    const row = makeRow([
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11'
    ])

    it('真末段且结束格 = endAt 当日 → 显示', () => {
        expect(showEndTimeInMonth(makeSeg(), row)).toBe(true)
    })

    it('非末段（跨行续接/裁剪段）→ 不显示', () => {
        expect(showEndTimeInMonth(makeSeg({ isEnd: false }), row)).toBe(false)
    })

    it('末段结束格与 endAt 当日不一致（裁剪到行尾）→ 不显示', () => {
        expect(showEndTimeInMonth(makeSeg({ colEnd: 4 }), row)).toBe(false)
    })

    it('endAt 缺失/非法 → 不显示', () => {
        expect(showEndTimeInMonth(makeSeg({ task: makeTask({ endAt: '' }) }), row)).toBe(false)
        expect(showEndTimeInMonth(makeSeg({ task: makeTask({ endAt: 'not-a-date' }) }), row)).toBe(
            false
        )
    })
})

describe('showEndTimeInWeek - 周视图段末截止时刻', () => {
    it('真末段且 endAt 合法 → 显示', () => {
        expect(showEndTimeInWeek(makeSeg())).toBe(true)
    })

    it('非末段（任务延续到本周之外）→ 不显示', () => {
        expect(showEndTimeInWeek(makeSeg({ isEnd: false }))).toBe(false)
    })

    it('endAt 缺失/非法 → 不显示', () => {
        expect(showEndTimeInWeek(makeSeg({ task: makeTask({ endAt: '' }) }))).toBe(false)
        expect(showEndTimeInWeek(makeSeg({ task: makeTask({ endAt: 'not-a-date' }) }))).toBe(false)
    })
})