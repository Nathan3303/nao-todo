import { describe, expect, it } from 'vite-plus/test'
import {
    applyQuickOption,
    daysInMonth,
    isoToValue,
    stepValue,
    valueToIso,
    valueToText
} from '../date-picker-core'

const base = { year: 2026, month: 6, day: 15, hour: 9, minute: 30 }

describe('datePickerCore - 日期选择核心', () => {
    it('nowToValue / isoToValue / valueToIso / valueToText 往返', () => {
        // 本地时区构造：期望与输入同时区一致（用本地 ISO 测试更稳）
        const local = new Date(2026, 5, 15, 9, 30).toISOString()
        expect(isoToValue(local).year).toBe(2026)
        expect(valueToIso(base)).toBe(new Date(2026, 5, 15, 9, 30).toISOString())
        expect(valueToText(base)).toBe('2026-06-15 09:30')
        expect(valueToText(base, false)).toBe('2026-06-15')
        // 空/非法回退当前时间
        expect(isoToValue(null, new Date(2026, 0, 1)).year).toBe(2026)
        expect(isoToValue('bad', new Date(2026, 0, 1)).year).toBe(2026)
    })

    it('daysInMonth：闰年 2 月', () => {
        expect(daysInMonth(2024, 2)).toBe(29)
        expect(daysInMonth(2026, 2)).toBe(28)
        expect(daysInMonth(2026, 6)).toBe(30)
    })

    it('stepValue：跨月/跨年/闰年自动归一化', () => {
        expect(stepValue({ ...base, month: 12, day: 31 }, 'month', 1)).toEqual({
            year: 2027,
            month: 1,
            day: 31,
            hour: 9,
            minute: 30
        })
        // 1/31 +1 月 → 2/28（2026 非闰年）
        expect(stepValue({ ...base, month: 1, day: 31 }, 'month', 1).day).toBe(28)
        // 2/29 闰年 +1 月 → 3/29
        expect(stepValue({ ...base, year: 2024, month: 2, day: 29 }, 'month', 1)).toEqual({
            year: 2024,
            month: 3,
            day: 29,
            hour: 9,
            minute: 30
        })
        // 日步进跨月
        expect(stepValue({ ...base, month: 6, day: 30 }, 'day', 1)).toEqual({
            year: 2026,
            month: 7,
            day: 1,
            hour: 9,
            minute: 30
        })
        // 时分循环
        expect(stepValue(base, 'hour', -10).hour).toBe(23)
        expect(stepValue(base, 'minute', 35).minute).toBe(5)
    })

    it('applyQuickOption：今天/明天保留时分，清空返回 null', () => {
        const now = new Date(2026, 5, 15, 9, 30)
        const today = applyQuickOption(base, 'today')
        expect(today?.year).toBe(2026)
        expect(today?.hour).toBe(9)

        const tomorrow = applyQuickOption(base, 'tomorrow')
        expect(tomorrow).not.toBeNull()

        const sunday = applyQuickOption(base, 'week-sunday')
        expect(sunday).not.toBeNull()

        const monday = applyQuickOption(base, 'week-monday')
        expect(monday).not.toBeNull()

        expect(applyQuickOption(base, 'clear')).toBeNull()
        void now
    })
})