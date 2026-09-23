/**
 * 覆盖度 / 触顶提示（分开表达）
 * @description 两条提示**独立**（不得合并成一条 —— 否则用户以为「多等一会就有」）：
 *              ① **未扫完（瞬态）**：引擎仍在续拉 ⇒「正在加载更多…」（拉完自动消失）；
 *              ② **触顶（常驻）**：`mirrorTruncated` ⇒「任务超过 N 条，仅显示前 N 条」（N 取实际上限）。
 *              判定信号来自引擎：`syncStatus.syncing`（瞬态）/ `syncStatus.mirrorTruncated`（常驻）。
 */

/** 覆盖度提示信号 */
export type CoverageHints = {
    /** 未扫完（瞬态，自动消失） */
    loadingMore: boolean
    /** 触顶（常驻） */
    truncated: boolean
}

/**
 * 解析覆盖度提示
 * @description 两条提示可同时为真（续拉中且本次运行已触顶）⇒ 组件分别渲染，不合并。
 */
export const resolveCoverageHints = (input: {
    syncing: boolean
    mirrorTruncated: boolean
}): CoverageHints => ({
    loadingMore: input.syncing,
    truncated: input.mirrorTruncated
})