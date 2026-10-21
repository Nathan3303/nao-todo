import { describe, expect, it } from 'vite-plus/test'
import { nowLabelLayoutOf } from '../now-label'

/**
 * T518-R5 / R11 当前时刻文本横向落位（AC8a 居中 · AC8b 视口贴边 · AC6b 轴端点）
 * @description 纯函数单测：给 `lineX / labelWidth / axisWidth / scrollLeft / viewportWidth` ⇒ 断言文本中心偏移。
 *              两条约束（轴端点 / 视口）取**更严格者**（交集），不互相覆盖。
 */

/** 默认几何：×1 触下限轴 960px、文本 40px、视口 200px */
const base = {
    lineX: 480,
    labelWidth: 40,
    axisWidth: 960,
    scrollLeft: 0,
    viewportWidth: 960
}

describe('T518-R5 AC8a 居中（未越界时偏移 0）', () => {
    it('中部（视口覆盖整轴）⇒ offset = 0、未钳制', () => {
        expect(nowLabelLayoutOf(base)).toEqual({ offsetPx: 0, isClamped: false })
    })

    it('可见区域内但非整轴（scrollLeft 380 / 视口 200）⇒ 仍居中', () => {
        const layout = nowLabelLayoutOf({ ...base, scrollLeft: 380, viewportWidth: 200 })
        expect(layout.offsetPx).toBe(0)
        expect(layout.isClamped).toBe(false)
    })
})

describe('T518-R5 AC8b 视口贴边（轴端点之外的第二重约束）', () => {
    it('线在可见区域左侧外 ⇒ 贴左可见边缘（文本左缘 = scrollLeft）', () => {
        const layout = nowLabelLayoutOf({
            ...base,
            lineX: 100,
            scrollLeft: 300,
            viewportWidth: 200
        })
        // 下界 = 300 + 20 = 320 ⇒ 中心 320 ⇒ 左缘 300
        expect(layout.offsetPx).toBe(220)
        expect(layout.isClamped).toBe(true)
    })

    it('线在可见区域右侧外 ⇒ 贴右可见边缘（文本右缘 = scrollLeft + 视口宽）', () => {
        const layout = nowLabelLayoutOf({ ...base, scrollLeft: 600, viewportWidth: 200 })
        // 下界 = 600 + 20 = 620 ⇒ 中心 620 ⇒ 右缘 640
        expect(layout.offsetPx).toBe(140)
        expect(layout.isClamped).toBe(true)
    })

    it('滚回中部 ⇒ 恢复居中（同一函数、无状态）', () => {
        expect(nowLabelLayoutOf({ ...base, scrollLeft: 380, viewportWidth: 200 }).offsetPx).toBe(0)
        expect(
            nowLabelLayoutOf({ ...base, scrollLeft: 600, viewportWidth: 200 }).offsetPx
        ).not.toBe(0)
    })

    it('切换点连续（AC8b：阈值附近不来回跳）：scrollLeft 每移 1px，偏移变化 ≤ 1px', () => {
        let previous = nowLabelLayoutOf({ ...base, scrollLeft: 0, viewportWidth: 200 }).offsetPx
        let maxJump = 0
        for (let scrollLeft = 1; scrollLeft <= 900; scrollLeft += 1) {
            const current = nowLabelLayoutOf({ ...base, scrollLeft, viewportWidth: 200 }).offsetPx
            maxJump = Math.max(maxJump, Math.abs(current - previous))
            previous = current
        }
        expect(maxJump).toBeLessThanOrEqual(1)
    })

    it('文本比可见区域还宽 ⇒ 贴左缘（绝不越界），不返回 NaN', () => {
        const layout = nowLabelLayoutOf({
            ...base,
            lineX: 100,
            labelWidth: 400,
            scrollLeft: 0,
            viewportWidth: 200
        })
        expect(Number.isFinite(layout.offsetPx)).toBe(true)
        expect(layout.offsetPx).toBe(100) // 中心 200 ⇒ 左缘 0 = scrollLeft
        expect(layout.isClamped).toBe(true)
    })
})

describe('T518-R5 AC6b 轴端点约束（保留，与视口取更严格者）', () => {
    it('轴起点附近（lineX 3.33）⇒ 文本左缘钳到 0（= 轴起点），不会被轴裁掉', () => {
        const layout = nowLabelLayoutOf({
            ...base,
            lineX: (5 / 1440) * 960,
            scrollLeft: 0,
            viewportWidth: 480
        })
        expect(layout.offsetPx).toBeCloseTo(16.67, 2) // 中心 20 ⇒ 左缘 0
        expect(layout.isClamped).toBe(true)
    })

    it('轴终点附近（lineX 956.7）⇒ 文本右缘钳到轴宽（= 24:00）', () => {
        const layout = nowLabelLayoutOf({
            ...base,
            lineX: (1435 / 1440) * 960,
            scrollLeft: 480,
            viewportWidth: 480
        })
        expect(layout.offsetPx).toBeCloseTo(-16.67, 2) // 中心 940 ⇒ 右缘 960
        expect(layout.isClamped).toBe(true)
    })

    it('两约束同时生效 ⇒ 取更严格者（视口比轴端点更靠内）', () => {
        const layout = nowLabelLayoutOf({
            ...base,
            lineX: 900,
            scrollLeft: 0,
            viewportWidth: 300
        })
        // 轴：中心 ≤ 940；视口：中心 ≤ 300 − 20 = 280 ⇒ 取 280
        expect(layout.offsetPx).toBe(280 - 900)
        expect(layout.isClamped).toBe(true)
    })
})

describe('T518-R5 降级（首帧未测量 / 非今天）', () => {
    it('文本宽 0（未测量）⇒ 偏移 0（保持居中，不跳变）', () => {
        expect(nowLabelLayoutOf({ ...base, labelWidth: 0 })).toEqual({
            offsetPx: 0,
            isClamped: false
        })
    })

    it('视口宽 0（首帧 / 未布局）⇒ 偏移 0', () => {
        expect(nowLabelLayoutOf({ ...base, viewportWidth: 0 })).toEqual({
            offsetPx: 0,
            isClamped: false
        })
    })
})