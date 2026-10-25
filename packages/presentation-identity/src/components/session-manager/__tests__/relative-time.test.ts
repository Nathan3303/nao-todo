// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { resolveSessionActiveAt } from '../relative-time'

/**
 * T535 · R3「最近活跃」时间分档（阈值表即契约）
 * @description 纯函数：`diff = now - t` 的六档 —— `<1 分钟`（含未来时间）/ `<1 小时`（N 分钟）/
 *              `<24 小时`（N 小时）/ `<48 小时`（昨天）/ `<7 天`（N 天）/ `≥7 天`（回落日期）。
 *              文案本地化不在本函数内（justNow / yesterday 走 i18n 键，N 分钟起走 Intl.RelativeTimeFormat）。
 */

/** 固定「现在」：2026-10-25 12:00 本地时间（禁 UTC 字面量，DEF-81） */
const NOW = new Date(2026, 9, 25, 12, 0, 0).getTime()

const at = (offsetMs: number): string => new Date(NOW - offsetMs).toISOString()

describe('resolveSessionActiveAt - 六档阈值', () => {
    it('缺失 / 空串 / 非法 ⇒ null（调用方不得渲染时间）', () => {
        expect(resolveSessionActiveAt(null, NOW)).toBeNull()
        expect(resolveSessionActiveAt(undefined, NOW)).toBeNull()
        expect(resolveSessionActiveAt('', NOW)).toBeNull()
        expect(resolveSessionActiveAt('not-a-date', NOW)).toBeNull()
    })

    it('B：未来时间（时钟偏差）⇒ justNow，不显示负数', () => {
        expect(resolveSessionActiveAt(at(-5 * 60_000), NOW)).toEqual({ kind: 'justNow' })
    })

    it('P：<1 分钟 ⇒ justNow（59s 仍为刚刚，60s 进分钟档）', () => {
        expect(resolveSessionActiveAt(at(59_000), NOW)).toEqual({ kind: 'justNow' })
        expect(resolveSessionActiveAt(at(60_000), NOW)).toEqual({
            kind: 'relative',
            amount: 1,
            unit: 'minute'
        })
    })

    it('P：<1 小时 ⇒ N 分钟（3 分钟前；59 分 59 秒仍为 59 分钟）', () => {
        expect(resolveSessionActiveAt(at(3 * 60_000), NOW)).toEqual({
            kind: 'relative',
            amount: 3,
            unit: 'minute'
        })
        expect(resolveSessionActiveAt(at(59 * 60_000 + 59_000), NOW)).toEqual({
            kind: 'relative',
            amount: 59,
            unit: 'minute'
        })
    })

    it('P：<24 小时 ⇒ N 小时（2 小时前；23h59m 仍为 23 小时）', () => {
        expect(resolveSessionActiveAt(at(2 * 3_600_000), NOW)).toEqual({
            kind: 'relative',
            amount: 2,
            unit: 'hour'
        })
        expect(resolveSessionActiveAt(at(23 * 3_600_000 + 59 * 60_000), NOW)).toEqual({
            kind: 'relative',
            amount: 23,
            unit: 'hour'
        })
    })

    it('P：24–48 小时 ⇒ yesterday（中文「昨天」/英文 yesterday，由调用方按键渲染）', () => {
        expect(resolveSessionActiveAt(at(24 * 3_600_000), NOW)).toEqual({ kind: 'yesterday' })
        expect(resolveSessionActiveAt(at(47 * 3_600_000), NOW)).toEqual({ kind: 'yesterday' })
    })

    it('P：2–7 天 ⇒ N 天（3 天前）', () => {
        expect(resolveSessionActiveAt(at(2 * 86_400_000), NOW)).toEqual({
            kind: 'relative',
            amount: 2,
            unit: 'day'
        })
        expect(resolveSessionActiveAt(at(3 * 86_400_000), NOW)).toEqual({
            kind: 'relative',
            amount: 3,
            unit: 'day'
        })
        expect(resolveSessionActiveAt(at(6 * 86_400_000 + 23 * 3_600_000), NOW)).toEqual({
            kind: 'relative',
            amount: 6,
            unit: 'day'
        })
    })

    it('E：≥7 天 ⇒ 回落为具体日期（不显示「7 天前」）', () => {
        const resolved = resolveSessionActiveAt(at(7 * 86_400_000), NOW)
        expect(resolved?.kind).toBe('date')
        if (resolved?.kind === 'date') {
            expect(resolved.date.getTime()).toBe(NOW - 7 * 86_400_000)
        }
    })
})