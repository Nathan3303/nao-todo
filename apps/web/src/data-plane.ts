import { registerBackfillTriggers } from '@nao-todo/infrastructure/src/persistence-sync/backfill-triggers'
import {
    flushPreferenceQueue,
    pullAndMergeUserConfig
} from '@nao-todo/infrastructure/src/persistence-sync/preference-sync'
import { resolveUserIdFromStoredJwt } from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { syncService } from '@nao-todo/infrastructure/src/persistence-sync/sync-service'
import { syncStatus } from '@nao-todo/infrastructure/src/persistence-sync/sync-status'
import { syncTracker } from '@nao-todo/infrastructure/src/persistence-sync/sync-tracker'
import { selfHealLegacyCipherMirror } from '@nao-todo/infrastructure/src/persistence-local/migration/legacy-cipher-self-heal'
import { startReadOnlyWatch } from '@nao-todo/presentation/offline'
import {
    showLegacyCipherBlockedNotice,
    showLegacyCipherRebuiltNotice
} from '@/components/legacy-cipher-notice'
import { applySyncConfirmation } from '@/offline-read-only'
import { withBootstrapRetry } from '@/views/auth/bootstrap-local-data'

/**
 * web 数据面运行接线（C-66 / AC8 / AC9）
 * @description web 侧**本地优先数据面**的后台运行入口（web 无 desktop 的 `AppRoot`/`InitialSyncGate`）：
 *              ① 注册回传触发源（`online` / 前台恢复 ⇒ 顺带重跑 `bootstrapLocalData`，C-61③）；
 *              ② 每个登录用户**首次进入时后台启动一次** `syncService.start()`，把远端数据拉入本地镜像
 *                 （拉取游标 / `mirrorPulledAt` / `mirrorTruncated` 由 T103 引擎与 `syncStatus` 落定）；
 *              ③ 注册本地写回传监听（`syncTracker.setDirtyListener` ⇒ `schedulePush`，PS-12）。
 *
 *              **旧密文一次性自愈（DEF-35 / C-68）**：拉取前先自愈（`selfHealLegacyCipherMirror`）——
 *              无残留时零行为变化；有残留且无未回传写入 ⇒ 丢弃本地密文副本 + 重置游标/新鲜度
 *              （⇒ 本次 `start()` 全量重拉）并可见告知；有未回传写入 ⇒ **阻塞**（绝不静默丢弃）。
 *
 *              **阶段二 2A 口径（ADR `2026-09-24-stage2-both-ends-local-first` §2.4 / §2.6）**：
 *              业务 7 域 binding = 本地仓储（读写均本地优先；本地写经 `syncTracker.markDirty` 入
 *              `syncQueue` 回传 ⇒ **`markDirty` 非 0 合法**，阶段一「web 业务恒 0」随 C-59 退场）；
 *              身份域 `user` 仍远端直连（W5）。本模块只负责**填充镜像 + 回传触发**，不改变任何鉴权状态。
 *
 *              调用时机：`main.ts` 挂载后（`app.ts`）经路由 `afterEach` + `router.isReady()` 触发，
 *              保证 `bootstrapLocalData`（`checkAndCleanExpired`）**先于** `syncService.start()`（C-61 顺序）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-60/C-66）
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md（§2.4 步骤 2 / §2.6 W5）
 */

/** 回传触发源是否已注册（整应用生命周期一次） */
let registered = false
/** 已触发过拉取的用户（切换账号需重拉；同一用户不重复拉） */
let activeUserId: string | null = null
/** 当前用户首次拉取已落定（成功/失败均落定）的 Promise（PS-16 首拉门；未启动为 null） */
let firstPullSettled: Promise<void> | null = null

/**
 * 幂等启动 web 数据面（可多次调用）
 * @description 同一用户只启动一次拉取；无 JWT（未登录）不启动。失败不抛出（由 `syncStatus` 暴露，
 *              镜像保持旧值且不谎报完整度）。
 */
export const startWebDataPlane = (): void => {
    // C-59 / AC10：启动离线只读监听（navigator.onLine ⇒ 只读状态；幂等）
    startReadOnlyWatch()
    if (!registered) {
        registered = true
        // PS-12 前置：本地写 → `markDirty` → 2s 防抖推送（desktop 同款，见 `AppRoot.vue`）。
        // web 阶段一缺此接线 ⇒ 切本地写路径后本地修改永不回传。
        syncTracker.setDirtyListener(() => {
            syncService.schedulePush()
        })
        // C-61③：常驻跨 7 天无冷启动 ⇒ 挂既有回传触发源顺带重跑启动收敛点（不新增定时器）
        // C-59 / ADR-r5.1：回传成功（真实执行 pull）⇒ 清除「离线进入」flag（网络恢复即可写）
        registerBackfillTriggers(
            withBootstrapRetry({
                handleOnline: () => {
                    void syncService.resumeBackfill().then(applySyncConfirmation)
                    // TASK-26 / M6：偏好队列复用既有触发源（online）冲刷，不新增重试机制
                    void flushPreferenceQueue()
                },
                handleVisibility: () => {
                    void syncService.resumeBackfill().then(applySyncConfirmation)
                    void flushPreferenceQueue()
                }
            })
        )
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
    // C-59 / ADR-r5.1：仅当**真实执行 pull**（`pullExecuted`）且无错误/凭证失败时清除只读 flag
    // PS-16 首拉门：暴露「首次拉取已落定」信号（成功/失败均落定，不抛出）
    // DEF-35 / C-68：① 拉取前先做旧密文一次性自愈（丢弃不可读副本 + 标记）⇒ ② 再全量重拉
    firstPullSettled = (async () => {
        try {
            const outcome = await selfHealLegacyCipherMirror(userId)
            if (outcome.action === 'healed') showLegacyCipherRebuiltNotice()
            else if (outcome.action === 'blocked') showLegacyCipherBlockedNotice(outcome.pending)
        } catch {
            // 自愈失败不得阻断数据面（不可读密文仍由渲染层拒读，不会被当空值/默认值）
        }
        await syncService.start().then(applySyncConfirmation)
    })().then(
        () => undefined,
        () => undefined
    )
    void firstPullSettled
    // TASK-26 / M6：启动先拉取 + LWW 合并设置面，再冲刷偏好队列（非阻塞；失败静默降级）
    void pullAndMergeUserConfig().then(() => flushPreferenceQueue())
}

/**
 * 重置模块内运行状态（**仅测试**：避免跨用例状态泄漏）
 */
export const resetWebDataPlaneForTest = (): void => {
    registered = false
    activeUserId = null
    firstPullSettled = null
}

/**
 * 当前用户首次拉取已落定（成功或失败）的 Promise（PS-16 web 首拉门）
 * @description 未登录/未启动时为 `null`；同一用户切换账号后指向新用户的首拉。
 *              仅作**等待信号**，不改变同步语义。
 */
export const getFirstPullSettled = (): Promise<void> | null => firstPullSettled

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