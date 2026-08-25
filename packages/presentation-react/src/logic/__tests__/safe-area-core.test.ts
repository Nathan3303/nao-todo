import { describe, expect, it } from 'vite-plus/test'
import {
    getSafeAreaPt,
    inferSafeAreaPt,
    px2pt,
    pt2rpx,
    readGlobalPropsInsets,
    resetSafeAreaCache
} from '../safe-area-core'

describe('safeAreaCore - 刘海/Home 条安全区', () => {
    it('px2pt / pt2rpx 换算', () => {
        expect(px2pt(141, 3)).toBe(47)
        expect(pt2rpx(47, 390)).toBe(90.38) // 390pt 屏宽：1rpx = 0.52pt
        expect(pt2rpx(0, 390)).toBe(0)
        expect(pt2rpx(47, 0)).toBe(0)
    })

    it('inferSafeAreaPt：iOS 刘海机 vs 普通机', () => {
        // iPhone 13 Pro：390x844 @3x
        expect(inferSafeAreaPt('iOS', 390, 3)).toEqual({ top: 47, bottom: 34 })
        // iPhone SE：375x667 @2x
        expect(inferSafeAreaPt('iOS', 375, 2)).toEqual({ top: 20, bottom: 0 })
        // Android
        expect(inferSafeAreaPt('Android', 412, 2.75)).toEqual({ top: 24, bottom: 0 })
    })

    it('readGlobalPropsInsets：物理像素 → pt；无注入返回 null', () => {
        expect(readGlobalPropsInsets(3)).toBeNull()
        // 无 globalThis.lynx（Node 环境）不抛错
        expect(readGlobalPropsInsets(3)).toBeNull()
    })

    it('getSafeAreaPt：Node 环境走兜底路径（platform 空 → Android 24pt）', () => {
        resetSafeAreaCache()
        const insets = getSafeAreaPt()
        expect(insets.top).toBe(24)
        resetSafeAreaCache()
    })
})