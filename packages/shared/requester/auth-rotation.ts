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

/**
 * 从 `Authorization` 请求头取 token 快照（T558）
 * @param authorization 原始头值（如 `Bearer eyJ...`；可能是 `Bearer null`）
 * @returns `undefined` = 头缺失 / 非 Bearer 形态（**无法比对** ⇒ 调用方沿用旧口径）；
 *          字符串 = 快照（可能是 `''` / `'null'` / `'undefined'`）
 */
export const extractBearerToken = (authorization: unknown): string | undefined => {
    if (typeof authorization !== 'string') return undefined
    const matched = /^Bearer\s+(.*)$/i.exec(authorization.trim())
    return matched?.[1]?.trim()
}

/**
 * 判定失效响应是否来自「陈旧请求」（T558 / DEF-93）
 * @description 失效判据必须是「**当前** token 失效」，而不是「收到了 10041」：
 *              - 请求快照缺失（`undefined`）⇒ **不**判陈旧（沿用旧口径，Web 端行为零变化）；
 *              - 快照为 `''` / `'null'` / `'undefined'`（`Bearer null` 等）⇒ **一律**陈旧；
 *              - 当前无 token（`null` / 未注入提供器 / `''`）⇒ 陈旧（无可失效的会话）；
 *              - 否则「快照 ≠ 当前」⇒ 陈旧（该响应属于已换掉的旧 token）。
 * @param requestToken 请求发出时的 token 快照（`extractBearerToken` 产物）
 * @param currentToken 当前 token（读取失败/未提供时传 `null`）
 * @returns `true` = 陈旧响应（调用方**不得**登出/清凭证/导航，只记录）
 */
export const isStaleTokenSnapshot = (
    requestToken: string | undefined,
    currentToken: string | null
): boolean => {
    if (requestToken === undefined) return false
    if (requestToken === '' || requestToken === 'null' || requestToken === 'undefined') return true
    if (currentToken === null || currentToken === '') return true
    return currentToken !== requestToken
}