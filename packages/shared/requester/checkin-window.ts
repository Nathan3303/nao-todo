/**
 * 检入在途窗口（T558 R1 / PM 实机验收 seq 13）
 *
 * @description 检入（`PUT /auth/checkin`）是「本次凭证结不有效」的**权威裁决点**，且它会**换发** token。
 *              冷启动时数据面（`syncService.start()` 的 pull）与检入页**同一次导航触发、并发发出**，
 *              二者带的是**同一个**旧 token ⇒ 检入换发成功后，那条在途 pull 必然拿 `10041`（旧 token 已废）。
 *              但此刻 store 里的 token **还没**换（检入响应未落地）⇒ token 快照比对判不出「陈旧」⇒
 *              被当成真实失效 ⇒ 清凭证 + 跳登录页 ⇒ 与检入成功**抢跑**（实机表现：`remove, remove, set`，
 *              清凭证栈含 `Proxy.clearAuthData`，随后检入成功又把新 token `set` 回去）。
 *
 *              ⇒ 检入在途期间，其它请求带回的 `10041` **一律延后处置**（不登出 / 不清凭证 / 不导航，只记录），
 *              由检入结果落定：成功 ⇒ 那些 `10041` 属于换发前的在途请求（陈旧）；失败 ⇒ 检入自身按凭证类清认证。
 *
 *              与 `auth-rotation` 的「轮换宽限」同族、互补：
 *              - 宽限覆盖换发**之后** 10s（`markTokenRotated()` 起算）；
 *              - 本窗口覆盖换发**之前/期间**（检入发起到落定）。
 *              ⛔ 不得把本窗口当「免死金牌」：窗口只在检入在途时存在（通常 <5s），窗外一切照旧。
 */

/** 在途检入计数（同一 token 单飞 ⇒ 事实上 ≤1；用计数便于嵌套/并发调用安全结算） */
let inFlight = 0

/** 待执行检入计划（守卫决定去 `/auth/checkin` / 检入页挂载时开启；落定/卸载/改道时关闭） */
let planned = 0

/** 当前计划窗口的关闭器（`null` = 无计划；幂等，避免守卫重复决策叠加多层窗口） */
let currentPlanClose: (() => void) | null = null

/** 开始一次检入（`AuthUseCase.checkIn` 单飞体入口调用；必须与 `endCheckIn` 成对） */
export const beginCheckIn = (): void => {
    inFlight += 1
}

/** 结束一次检入（`finally` 调用：成功/失败/冲突终态都要结算） */
export const endCheckIn = (): void => {
    inFlight = inFlight > 0 ? inFlight - 1 : 0
}

/**
 * 开启「待执行检入计划」窗口（T558 R3）
 * @description **必须在决定检入的那一刻调用**（路由守卫判定去 `/auth/checkin`），
 *              **早于**数据面 `syncService.start()` / `GET|PUT /user/config` 的派发。
 *              实机 bracket 实测（`qa-T556`，未修版本）：`10041` 可与数据面请求**同 tick** 到达，
 *              那时检入请求还**未派发**（`checkins=0`）⇒ 只看「检入在途」挡不住这一格。
 *              幂等：已有计划 ⇒ 不重复开（守卫每次导航都会决策）。
 */
export const openCheckInPlan = (): void => {
    if (currentPlanClose !== null) return
    planned += 1
    let closed = false
    currentPlanClose = () => {
        if (closed) return
        closed = true
        currentPlanClose = null
        planned = planned > 0 ? planned - 1 : 0
    }
}

/** 关闭当前「待执行检入计划」（幂等；检入落定 / 检入页卸载 / 守卫改道时调用） */
export const closeCheckInPlan = (): void => {
    currentPlanClose?.()
}

/**
 * 当前是否有检入在途**或待执行检入计划**（`true` ⇒ 失效处置必须延后，由检入结果裁决）
 * @description 两个维度互补：`inFlight` 覆盖「已派发、未落定」，`planned` 覆盖「已决定去检入、
 *              请求尚未派发」（R3 实机缺口）。**都不覆盖「无检入计划」的普通会话** ⇒ 真实失效照旧登出。
 */
export const isCheckInInFlight = (): boolean => inFlight > 0 || planned > 0

/** 复位（仅测试 / 会话整体重置用） */
export const resetCheckInWindow = (): void => {
    inFlight = 0
    planned = 0
    currentPlanClose = null
    resetCheckInConflictStreak()
}

/* —— 检入冲突连续计数（`DEF-119`：区分「并发检入」与「他端改密 / 会话被撤销」） —— */

/**
 * 冲突「并发」窗口（ms）
 * @description **极短**窗口：真正的并发检入（同一 tick / 快速刷新 / 双提交）才落在 3s 内；
 *              而用户看到失败态、读文案、再点「重试」通常远超 3s ⇒ 不构成并发证据（T599 / `F4`）。
 *              用户手动重试**仍得** `10022` ⇒ 反而**提高**「非并发」的置信度（用例层已自动重试一次）。
 */
export const CHECK_IN_CONFLICT_CONCURRENCY_WINDOW_MS = 3000

/** 窗口内的连续冲突次数（两次间隔超过窗口 ⇒ 重新从 1 计） */
let conflictStreak = 0
let lastConflictAt = 0

/**
 * 记一次检入冲突（`10022`）
 * @description 判据（T599 / `F4`）：**极短窗口内的连续冲突**才当作并发证据，且**只影响文案**
 *              （主次按钮恒为「重新登录」，不随次数降级）。
 *              ⛔ 不参与会话失效判据（`10022` 永远不是登出理由，T558 R1 不回归）。
 * @param now 当前时间（ms；仅测试注入）
 * @returns 窗口内的连续冲突次数（首次 = 1）
 */
export const markCheckInConflict = (now: number = Date.now()): number => {
    conflictStreak =
        lastConflictAt > 0 && now - lastConflictAt <= CHECK_IN_CONFLICT_CONCURRENCY_WINDOW_MS
            ? conflictStreak + 1
            : 1
    lastConflictAt = now
    return conflictStreak
}

/**
 * 复位连续冲突计数（**生产代码专用**）
 * @description 生命周期边界 = 检入成功 / 检入页卸载 / 登出 / 换账号（T599）。
 *              ⛔ 不要用 `resetCheckInWindow()` 代替：它还会把 `inFlight` / `planned` 归零，
 *              会关掉 T558「检入在途期间 `10041` 延后处置」的保护。
 */
export const resetCheckInConflictStreak = (): void => {
    conflictStreak = 0
    lastConflictAt = 0
}