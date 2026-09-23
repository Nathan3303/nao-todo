import { deletionService, syncService, syncTracker } from '@nao-todo/infrastructure'
import { t } from '@nao-todo/shared'
import { NueConfirm } from 'nue-ui'

/**
 * 登出清库编排（C-54 脏队列护栏 + C-52 `wipeUserData` 单一入口）
 *
 * @description 顺序硬约束：**先护栏、后清库**（护栏取消 ⇒ 返回 false，**不得清库、不得继续登出**）。
 *              脏队列权威口径 = `syncTracker.countDirty(userId)`（**禁读** `syncStatus.pendingCount`，
 *              后者仅在 `endRun()` 刷新 ⇒ 滞后 = DEF-13）。
 *              ① `countDirty === 0` ⇒ 直接清库；
 *              ② `> 0` ⇒ **阻塞确认**（显示 N + 「先同步」）⇒ 用户选「先同步」则 `syncService.start()`；
 *              ③ 同步后仍 `> 0`（离线/失败）⇒ **二次确认**并明示不可恢复；
 *              ④ 用户确认后 `wipeUserData(userId)`（IndexedDB 事务 + localStorage 黑白名单）。
 *              清库后 **不清认证** —— 由调用方在返回 true 后执行（保证取消时不破坏会话）。
 * @returns 是否已清库（true = 可继续登出流程）
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-52 / C-54）
 */
export const wipeLocalDataOnSignOut = async (userId: string): Promise<boolean> => {
    if (!userId) return true

    let dirty = await syncTracker.countDirty(userId)
    if (dirty > 0) {
        const [cancelled] = await NueConfirm({
            title: t('signOut.dirtyTitle'),
            content: t('signOut.dirtyContent', { count: dirty }),
            confirmButtonText: t('signOut.syncFirst'),
            cancelButtonText: t('common.cancel')
        })
        if (cancelled) return false

        // 「先同步」尽力而为：失败/离线不阻断，转二次确认（明示不可恢复）
        try {
            await syncService.start()
        } catch {
            /* 同步失败：交由二次确认处理 */
        }
        dirty = await syncTracker.countDirty(userId)
        if (dirty > 0) {
            const [cancelSecond] = await NueConfirm({
                title: t('signOut.unsavedTitle'),
                content: t('signOut.unsavedContent', { count: dirty }),
                confirmButtonText: t('signOut.signOutAnyway'),
                cancelButtonText: t('common.cancel')
            })
            if (cancelSecond) return false
        }
    }

    await deletionService.wipeUserData(userId)
    return true
}