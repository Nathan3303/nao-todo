import { describe, expect, it } from 'vite-plus/test'
import {
    isDateKeyInMonth,
    MONTH_VALUES,
    monthFirstDateKey,
    offsetYear,
    pad2,
    weekStartKeyOfMonthFirst
} from './month-jump'

describe('C2-F9 month-jump 纯逻辑', () => {
    it('月格数组 1~12 与补零/年偏移', () => {
        expect(MONTH_VALUES).toHaveLength(12)
        expect(MONTH_VALUES[0]).toBe(1)
        expect(MONTH_VALUES[11]).toBe(12)
        expect(pad2(3)).toBe('03')
        expect(offsetYear(2026, -1)).toBe(2025)
        expect(offsetYear(2026, 1)).toBe(2027)
    })

    it('目标月 1 号日期键', () => {
        expect(monthFirstDateKey(2026, 9)).toBe('2026-09-01')
        expect(monthFirstDateKey(2027, 12)).toBe('2027-12-01')
    })

    it('含 1 号周的周起点（weekStart 边界：月首周日/周一可能落上月）', () => {
        // 2026-09-01 是周二（sunday 起点周 => 周日起 08-30；monday 起点 => 08-31）
        expect(weekStartKeyOfMonthFirst(2026, 9, 'sunday')).toBe('2026-08-30')
        expect(weekStartKeyOfMonthFirst(2026, 9, 'monday')).toBe('2026-08-31')
        // 2027-01-01 周五：sunday 周起点跨年到 2026-12-27
        expect(weekStartKeyOfMonthFirst(2027, 1, 'sunday')).toBe('2026-12-27')
        // 月首即周一起点日（2026-06-01 周一 => 当天为周起点）
        expect(weekStartKeyOfMonthFirst(2026, 6, 'monday')).toBe('2026-06-01')
    })

    it('原选中日是否落在目标月（保留/清除判定）', () => {
        expect(isDateKeyInMonth('2026-09-15', 2026, 9)).toBe(true)
        expect(isDateKeyInMonth('2026-10-01', 2026, 9)).toBe(false)
        expect(isDateKeyInMonth('2026-09-15', 2027, 9)).toBe(false)
        expect(isDateKeyInMonth('2026-09-15', 2026, 10)).toBe(false)
    })
})