import { revokeOfflineEntry } from '@/views/auth/offline-entry'

/**
 * web 离线只读闸门 —— 会话级「离线进入」flag 生命周期（C-59 / AC10 / ADR-r5.1）
 * @description 拦截条件 = `navigator.onLine === false` **或** 会话级「离线进入」flag
 *              （判定单一真源见 `@nao-todo/presentation/offline` 的 `isReadOnly`）。
 *              解除 = **本会话真实成功同步之后**清除 flag（否则网络恢复后会**永久只读**）。
 *
 *              ⚠️ **不得**用 `runResult.ok` / `lastSyncAt` 反推「会话已确认」：`start()` 在
 *              注销宽限期（`deletionSchedules` 命中）与 `!userId` 时会**早退**，但仍经
 *              `endRun` 返回 `ok === true` 并推进 `lastSyncAt`（空运行）。故判据必须叠加引擎的
 *              **`pullExecuted`**（真实执行了 `pullAllInner()`；T107c 追加的运行时字段，不落盘）。
 *
 *              清除后仍以 `navigator.onLine` 兜底：再次断网 ⇒ 立即回只读。
 *              flag 不落盘（刷新即失效）；仅 web 语义（desktop 不套用闸门）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-59 / §10.9）
 */

/**
 * 同步运行结果中的「会话已确认」判定输入
 * @description 与引擎 `SyncRunResult` 结构兼容（`pullExecuted` 为 T107c 追加的运行时字段）。
 *              结构上要求 `pullExecuted` 存在：**缺少即不确认**（宁可不清 flag，也不误清）。
 */
export type SyncConfirmation = {
    ok: boolean
    credentialFailure: boolean
    pullExecuted: boolean
}

/**
 * 本会话是否已被「真实成功同步」确认
 * @description `ok === true && !credentialFailure && pullExecuted === true`；三者缺一不可。
 *              宽限期/`!userId` 的空运行 `ok === true` 但 `pullExecuted === false` ⇒ 判否。
 */
export const isSessionConfirmed = (result: SyncConfirmation): boolean =>
    result.ok === true && result.credentialFailure !== true && result.pullExecuted === true

/**
 * 应用同步结果：确认后清除离线进入 flag（⇒ 恢复可写；`navigator.onLine` 仍兜底）
 */
export const applySyncConfirmation = (result: SyncConfirmation): void => {
    if (isSessionConfirmed(result)) revokeOfflineEntry()
}