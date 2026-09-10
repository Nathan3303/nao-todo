/**
 * 离线进入授权（会话级 flag）
 * @description SHELL-03 附录 B / C-22…C-25：仅表示"用户在本会话内**显式选择**了离线进入"这一意图，
 *              是 auth 守卫四条件中最弱的一项。**不得作为鉴权依据**（C-19/C-25）：服务器资源仍由
 *              服务端裁决，10041 三处兜底（main.ts `onAuthExpired` / AppRoot session-expired /
 *              sync-service 10041 分支）会在下一个请求清认证并跳登录页。
 *              介质为**内存**（不落盘）：刷新即失效 ⇒ 不存在"粘性绕过"。
 *              生命周期（C-25）：登录/检入成功、`clearAuthData()`、10041 会话失效、登出 ⇒ **必须清**。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md（附录 B-1/B-2）
 */

let granted = false

/** 授予离线进入（仅由 AppRoot 在用户显式选择「离线进入」时调用） */
export const grantOfflineEntry = (): void => {
    granted = true
}

/** 撤销离线进入授权（登录/检入成功、清认证数据、10041、登出） */
export const revokeOfflineEntry = (): void => {
    granted = false
}

/** 当前会话是否已授予离线进入（auth 守卫读取） */
export const isOfflineEntryGranted = (): boolean => granted