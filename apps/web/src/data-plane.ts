import {
    registerBackfillTriggers,
    resolveUserIdFromStoredJwt,
    syncService,
    syncStatus
} from '@nao-todo/infrastructure'
import { withBootstrapRetry } from '@/views/auth/bootstrap-local-data'

/**
 * web 数据面运行接线（C-66 / AC8 / AC9）
 * @description web 侧**只读离线镜像**的后台运行入口（web 无 desktop 的 `AppRoot`/`InitialSyncGate`）：
 *              ① 注册回传触发源（`online` / 前台恢复 ⇒ 顺带重跑 `bootstrapLocalData`，C-61③）；
 *              ② 每个登录用户**首次进入时后台启动一次** `syncService.start()`，把远端数据拉入本地镜像
 *                 （拉取游标 / `mirrorPulledAt` / `mirrorTruncated` 由 T103 引擎与 `syncStatus` 落定）。
 *
 *              与读路径的分工：`@/hooks/usecases/binding` 保持**远端优先**、网络类失败回退本地镜像；
 *              本模块只负责**填充镜像**，不改变任何鉴权状态，也不触碰写路径
 *              （C-59：阶段一数据面不得产生 `markDirty`，UI 层禁写另由 T108 承担）。
 *
 *              调用时机：`main.ts` 挂载后（`app.ts`）经路由 `afterEach` + `router.isReady()` 触发，
 *              保证 `bootstrapLocalData`（`checkAndCleanExpired`）**先于** `syncService.start()`（C-61 顺序）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-60/C-66）
 */

/** 回传触发源是否已注册（整应用生命周期一次） */
let registered = false
/** 已触发过拉取的用户（切换账号需重拉；同一用户不重复拉） */
let activeUserId: string | null = null

/**
 * 幂等启动 web 数据面（可多次调用）
 * @description 同一用户只启动一次拉取；无 JWT（未登录）不启动。失败不抛出（由 `syncStatus` 暴露，
 *              镜像保持旧值且不谎报完整度）。
 */
export const startWebDataPlane = (): void => {
    if (!registered) {
        registered = true
        // C-61③：常驻跨 7 天无冷启动 ⇒ 挂既有回传触发源顺带重跑启动收敛点（不新增定时器）
        registerBackfillTriggers(withBootstrapRetry(syncService))
    }
    const userId = resolveUserIdFromStoredJwt()
    // 未登录（JWT 已清，如登出）：重置已拉取标记 ⇒ 同一用户重新登录后会重新拉取
    if (!userId) {
        activeUserId = null
        return
    }
    if (userId === activeUserId) return
    activeUserId = userId
    // 非阻塞：不阻塞进入应用；本条即「web 也用 syncService + 本地镜像」的接线点
    void syncService.start()
}

/**
 * 重置模块内运行状态（**仅测试**：避免跨用例状态泄漏）
 */
export const resetWebDataPlaneForTest = (): void => {
    registered = false
    activeUserId = null
}

/**
 * 镜像新鲜度（C-60 文案三分 / 覆盖度-触顶 的 UI 输入）
 * @description 由 T103 引擎在 `syncStatus` 落定：
 *              - `mirrorPulledAt === null` ⇒ 「尚未同步完成，数据可能不完整」（**不得**显示"截至 X"）；
 *              - `mirrorPulledAt` 有值 + `mirrorTruncated === false` ⇒ 完整镜像（"数据截至 X"）；
 *              - `mirrorTruncated === true` ⇒ 续拉触顶（"可能不完整"）。
 *              `pagination.total` 由各 `list()` 返回值提供（本函数不参与）。
 */
export const getMirrorState = (): { mirrorPulledAt: string | null; mirrorTruncated: boolean } => {
    const { mirrorPulledAt, mirrorTruncated } = syncStatus.get()
    return { mirrorPulledAt, mirrorTruncated }
}