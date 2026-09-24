import { describe, expect, it } from 'vite-plus/test'
import { formatMirrorPulledAt, isValidMirrorTime, resolveFreshness } from '../freshness'

/**
 * C-60 文案三分断言（AC8 / AC9）
 * @description 负向断言：非法/缺失时间**不得**落「数据截至 X」，且格式化结果**不得**出现
 *              `null` / `Invalid Date` / `1970`（epoch）。
 */

const VALID_ISO = '2026-09-23T07:30:00.000Z'

describe('resolveFreshness - C-60 三分（互斥穷尽）', () => {
    it('在线 ⇒ updated（不显示时间）', () => {
        expect(
            resolveFreshness({ isOffline: false, mirrorPulledAt: null, mirrorTruncated: false })
        ).toBe('updated')
    })

    it('离线 + 有效镜像时间 ⇒ mirror', () => {
        expect(
            resolveFreshness({
                isOffline: true,
                mirrorPulledAt: VALID_ISO,
                mirrorTruncated: false
            })
        ).toBe('mirror')
    })

    it('离线 + mirrorPulledAt 为空 ⇒ incomplete（禁止显示「截至 X」）', () => {
        expect(
            resolveFreshness({ isOffline: true, mirrorPulledAt: null, mirrorTruncated: false })
        ).toBe('incomplete')
    })

    it('离线 + 非法时间 ⇒ incomplete（负向：不得落 mirror）', () => {
        for (const bad of ['Invalid Date', '', 'not-a-date', '1970-01-01T00:00:00.000Z']) {
            expect(
                resolveFreshness({ isOffline: true, mirrorPulledAt: bad, mirrorTruncated: false })
            ).toBe('incomplete')
        }
    })

    it('离线 + 截断 ⇒ incomplete（截断不得谎报「数据截至 X」）', () => {
        expect(
            resolveFreshness({ isOffline: true, mirrorPulledAt: VALID_ISO, mirrorTruncated: true })
        ).toBe('incomplete')
    })
})

describe('formatMirrorPulledAt - 负向断言（无 null / Invalid Date / 1970）', () => {
    it('有效时间 ⇒ 本地化字符串（不含 null / Invalid Date / 1970）', () => {
        const text = formatMirrorPulledAt(VALID_ISO, 'zh-CN')
        expect(text).toBeTruthy()
        expect(text).not.toContain('null')
        expect(text).not.toContain('Invalid Date')
        expect(text).not.toContain('1970')
    })

    it('无效/缺失时间 ⇒ null（调用方不得渲染时间）', () => {
        for (const bad of [null, '', 'Invalid Date', '1970-01-01T00:00:00.000Z']) {
            expect(formatMirrorPulledAt(bad, 'zh-CN')).toBeNull()
        }
    })

    it('isValidMirrorTime 拒 epoch 与非法串', () => {
        expect(isValidMirrorTime(VALID_ISO)).toBe(true)
        expect(isValidMirrorTime('1970-01-01T00:00:00.000Z')).toBe(false)
        expect(isValidMirrorTime('Invalid Date')).toBe(false)
        expect(isValidMirrorTime(null)).toBe(false)
    })
})