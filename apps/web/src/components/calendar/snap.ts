/**
 * 分钟吸附纯函数（ADR 2026-09-21 §4.4 / C10 / D4）
 * @description 手势量化：快速新建＝`floor`（落格首）、拖拽/拉伸＝`round`（取最近）。
 *              **显示路径禁调用**（保全 AC2 的分钟级连续定位）。
 */

/** 吸附模式：向下取整 / 四舍五入到最近槽（中点取上界，Math.round 语义） */
export type SnapMode = 'floor' | 'round'

/**
 * 将分钟值吸附到 `step` 的整数倍
 * @param value 分钟值（当日 00:00 起偏移，允许小数）
 * @param step 吸附步长（默认 30）
 * @param mode 吸附模式（默认 `floor`）
 */
export const snapMinutes = (value: number, step = 30, mode: SnapMode = 'floor'): number => {
    const quantize = mode === 'round' ? Math.round : Math.floor
    return quantize(value / step) * step
}