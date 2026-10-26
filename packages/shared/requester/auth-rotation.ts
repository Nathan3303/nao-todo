/**
 * token 轮换宽限（R2 / AC6 / T3；Issue #260 热修：窗口内**全员生效**）
 *
 * @description 续期换发新 token 会让**旧 token 立即失效** ⇒ 在途请求收到 `10041`
 *              ⇒ 误判「被下线」并清凭证（自伤登出）。护栏：`markTokenRotated()` 之后
 *              **10s 窗口内**到达的 `10041` **一律不触发登出**（不置 `authExpiredFired`，
 *              该请求如实失败，由同步层既有退避重试）。同一次轮换的在途旧 token 请求
 *              可能不止一个（登录/续期瞬间的 pull / profile / config / epoch 并发）⇒
 *              **单次消费不够**（#260：第二个 10041 即登出 ⇒ 登录卡死/被踢），改为窗口内全员生效。
 *              宽限仍只武装于轮换时刻；窗口外的真实失效正常登出。
 *              **Web 端从不 `mark` ⇒ 行为零变化**（未 mark 时 `consumeRotationGrace` 恒 false）。
 * @see docs/reports/T543-arch-review.md（§五 5.3 / §六 轮换竞态 / §七 R2）
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（§八 已知采纳风险 R2）
 * @see https://github.com/Nathan3303/nao-todo/issues/260（登录后卡登录页根因）
 */

/** 宽限窗（10s，评审定值） */
export const TOKEN_ROTATION_GRACE_MS = 10_000

/** 最近一次轮换时刻；`null` = 从未轮换（Web 端常态） */
let rotatedAt: number | null = null

/**
 * 标记刚刚完成一次 token 轮换（续期成功后调用）
 * @param now 轮换时刻（缺省当前时间；单测可注入）
 */
export const markTokenRotated = (now: number = Date.now()): void => {
    rotatedAt = now
}

/**
 * 消费轮换宽限（窗口内每次 10041 均放行；窗口本身仍单次轮换一次武装）
 * @param now 判定时刻（缺省当前时间）
 * @returns `true` = 宽限内，调用方**不得**触发登出
 */
export const consumeRotationGrace = (now: number = Date.now()): boolean => {
    if (rotatedAt === null) return false
    const elapsed = now - rotatedAt
    // 时钟回拨（elapsed < 0）不放行：保守按真实失效处理
    if (elapsed < 0 || elapsed > TOKEN_ROTATION_GRACE_MS) return false
    return true
}

/** 清除轮换窗口（登出 / 测试隔离） */
export const resetTokenRotation = (): void => {
    rotatedAt = null
}