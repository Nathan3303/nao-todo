import {
    deletionService,
    localSession,
    resolveUserIdFromStoredJwt,
    type BackfillTriggerTarget
} from '@nao-todo/infrastructure'

/**
 * 本地数据启动收敛点（C-61 / DEF-10）
 * @description **唯一**负责「JWT → 本地会话重建 + 注销到期清理」的启动路径：
 *              先 `resumePendingWipe()`（C-53：补完崩溃/强杀遗留的清库，可重入），再
 *              `userId ??= resolveUserIdFromStoredJwt()` → `localSession.setCurrentUserId(userId)`
 *              → `await deletionService.checkAndCleanExpired(userId)`。
 *              顺序硬约束：**必须早于 `syncService.start()`**（`start()` 读 `deletionSchedules`
 *              决定是否跳过启动同步）。`userId` 为空（未登录）⇒ no-op（C-55 硬失败）。
 *              调用点：① desktop 冷启动（`AppRoot` 渲染任一门前 await）② 门 B 通过、挂载 App 前
 *              （`views/auth/routes.ts` `beforeEnter`，web 无 `AppRoot`）③ 常驻跨 7 天
 *              （`withBootstrapRetry` 挂既有回传触发源，**不新增定时器**）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-61）
 */
export const bootstrapLocalData = async (userId?: string | null): Promise<void> => {
    // C-53：先补完崩溃/强杀遗留的清库（可重入；清库完成后标记自行删除）
    await deletionService.resumePendingWipe()
    const uid = userId ?? resolveUserIdFromStoredJwt()
    if (!uid) return
    localSession.setCurrentUserId(uid)
    await deletionService.checkAndCleanExpired(uid)
}

/**
 * 回传触发源包装（C-61 调用点③）
 * @description 应用常驻跨过注销反悔期（7 天）时无冷启动 ⇒ 挂既有 `registerBackfillTriggers`
 *              的 `online` / 前台恢复触发源**顺带**重跑启动收敛点。
 *              仅作触发，不改变任何鉴权/放行状态（C-43）。
 */
export const withBootstrapRetry = (target: BackfillTriggerTarget): BackfillTriggerTarget => ({
    handleOnline: () => {
        target.handleOnline()
        void bootstrapLocalData()
    },
    handleVisibility: () => {
        target.handleVisibility()
        void bootstrapLocalData()
    }
})