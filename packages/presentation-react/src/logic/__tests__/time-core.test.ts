import { describe, expect, it } from 'vite-plus/test'
import { formatDateTime, formatRelativeTime } from '../time-core'

describe('timeCore - 时间格式化', () => {
    it('formatDateTime：空值返回空串，非法日期返回空串', () => {
        expect(formatDateTime(null)).toBe('')
        expect(formatDateTime(undefined)).toBe('')
        expect(formatDateTime('not-a-date')).toBe('')
    })

    it('formatDateTime：日期与时间格式', () => {
        expect(formatDateTime('2026-06-01T09:30:00.000Z')).toBe('2026-06-01')
        expect(formatDateTime('2026-06-01T09:30:00.000Z', true)).toMatch(/^2026-06-01 \d{2}:\d{2}$/)
    })

    it('formatRelativeTime：未来时间显示完整日期时间', () => {
        const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()
        expect(formatRelativeTime(future)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    })

    it('formatRelativeTime：刚刚 / 分钟 / 小时', () => {
        expect(formatRelativeTime(new Date().toISOString())).toBe('刚刚')
        const minutesAgo = new Date(Date.now() - 1000 * 60 * 5).toISOString()
        expect(formatRelativeTime(minutesAgo)).toBe('5 分钟前')
        const hoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
        expect(formatRelativeTime(hoursAgo)).toBe('3 小时前')
    })

    it('formatRelativeTime：昨天 / N 天前 / 空值', () => {
        const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.2).toISOString()
        expect(formatRelativeTime(yesterday)).toBe('昨天')
        const daysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
        expect(formatRelativeTime(daysAgo)).toBe('3 天前')
        expect(formatRelativeTime(null)).toBe('')
        expect(formatRelativeTime('')).toBe('')
    })
})