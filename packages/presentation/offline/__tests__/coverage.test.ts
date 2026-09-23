import { describe, expect, it } from 'vite-plus/test'
import { resolveCoverageHints } from '../coverage'

/**
 * 覆盖度/触顶提示断言（分开表达）
 * @description 未扫完（瞬态）与触顶（常驻）为**两条独立**信号，不得合并成一条。
 */
describe('resolveCoverageHints - 覆盖度/触顶（分开表达）', () => {
    it('续拉中 ⇒ loadingMore=true（瞬态）', () => {
        expect(resolveCoverageHints({ syncing: true, mirrorTruncated: false })).toEqual({
            loadingMore: true,
            truncated: false
        })
    })

    it('触顶 ⇒ truncated=true（常驻）', () => {
        expect(resolveCoverageHints({ syncing: false, mirrorTruncated: true })).toEqual({
            loadingMore: false,
            truncated: true
        })
    })

    it('两者可同时为真，且保持独立字段（不合并）', () => {
        expect(resolveCoverageHints({ syncing: true, mirrorTruncated: true })).toEqual({
            loadingMore: true,
            truncated: true
        })
    })

    it('均无 ⇒ 双 false', () => {
        expect(resolveCoverageHints({ syncing: false, mirrorTruncated: false })).toEqual({
            loadingMore: false,
            truncated: false
        })
    })
})