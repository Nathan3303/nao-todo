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

/** 开始一次检入（`AuthUseCase.checkIn` 单飞体入口调用；必须与 `endCheckIn` 成对） */
export const beginCheckIn = (): void => {
    inFlight += 1
}

/** 结束一次检入（`finally` 调用：成功/失败/冲突终态都要结算） */
export const endCheckIn = (): void => {
    inFlight = inFlight > 0 ? inFlight - 1 : 0
}

/** 当前是否有检入在途（`true` ⇒ 失效处置必须延后，由检入结果裁决） */
export const isCheckInInFlight = (): boolean => inFlight > 0

/** 复位（仅测试 / 会话整体重置用） */
export const resetCheckInWindow = (): void => {
    inFlight = 0
}