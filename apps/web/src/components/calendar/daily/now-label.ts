/**
 * 当前时刻文本的横向落位（T518-R5 / R11 / AC8a·AC8b；纯函数，无 Vue / DOM 依赖）
 * @description 文本**水平中心**默认 = now-line 的 x；两条约束**取更严格者**（不是互相覆盖）：
 *              1. **轴端点**（AC6b / R8）：文本盒必须落在轴 `[0, axisWidth]` 内；
 *              2. **视口**（AC8b / R11）：文本盒必须落在**当前可见区域** `[scrollLeft, scrollLeft + viewportWidth]` 内。
 *              切换点 = 文本盒边缘**恰好**触及可见边缘（`半宽 > 距边距离`）；因为位移被上下界夹住，
 *              偏移随 scrollLeft 连续变化 ⇒ 阈值附近不会来回跳（且样式禁用 transition / animation）。
 * @returns `offsetPx`：文本中心相对线 x 的偏移（0 = 居中；正值 = 右移；负值 = 左移）
 */

export type NowLabelLayoutInput = {
    /** 线在轴上的 x（px） */
    lineX: number
    /** 文本盒宽度（px；由调用方缓存测量结果） */
    labelWidth: number
    /** 轴总宽（px） */
    axisWidth: number
    /** 可见区域左缘在轴上的 x（= 滚动容器 scrollLeft） */
    scrollLeft: number
    /** 可见区域宽度（= 滚动容器 clientWidth） */
    viewportWidth: number
}

export type NowLabelLayout = {
    /** 文本中心相对线的偏移（px） */
    offsetPx: number
    /** 是否被钳制（false = 完全居中于线） */
    isClamped: boolean
}

/**
 * 计算文本中心相对线的偏移
 * @description 任一几何量缺失（首帧未测量 / 非今天）⇒ 偏移 0（保持居中，不引入跳变）。
 *              文本盒比可见区域还宽（极端窄视口）⇒ 贴左缘，保证不越界。
 */
export const nowLabelLayoutOf = ({
    lineX,
    labelWidth,
    axisWidth,
    scrollLeft,
    viewportWidth
}: NowLabelLayoutInput): NowLabelLayout => {
    if (!(labelWidth > 0) || !(axisWidth > 0) || !(viewportWidth > 0)) {
        return { offsetPx: 0, isClamped: false }
    }
    const half = labelWidth / 2
    // 两条约束的交集：下界取更靠右者、上界取更靠左者（= 取更严格者）
    const lower = Math.max(half, scrollLeft + half)
    const upper = Math.min(axisWidth - half, scrollLeft + viewportWidth - half)
    // 交集为空（文本比可见区域宽 / 轴太窄）⇒ 贴左缘，绝不越界
    const center = lower > upper ? lower : Math.min(Math.max(lineX, lower), upper)
    return { offsetPx: center - lineX, isClamped: center !== lineX }
}