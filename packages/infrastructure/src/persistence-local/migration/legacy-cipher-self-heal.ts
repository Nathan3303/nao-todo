import { logStructured, STRUCTURED_LOG_EVENTS } from '../../observability/structured-log'
import { loadPreferenceQueue } from '../../persistence-sync/preference-queue'
import { saveMirrorStatus } from '../../persistence-sync/mirror-status-store'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { localDatabase, type MetaRecord } from '../db/local-database'
import {
    hasLegacyCipherResidue,
    LEGACY_CIPHER_TABLES,
    plaintextMigrationMarkerId
} from './plaintext-migration'

/**
 * web 旧密文一次性自愈（DEF-35 / C-68）
 *
 * 背景：web origin 上若残留旧版本密文（非 `plain:`），web 无解锁门 ⇒ `decrypt` 抛
 * 「本地密钥未解锁」⇒ 行**静默不可见**（不报错、不渲染）。web 本地只是**服务端镜像**，
 * 因此处置 = **丢弃本地密文副本 + 从服务端重新拉全量镜像**（服务端为权威真源）。
 *
 * 硬约束：
 * - **护栏（C-54 同口径）**：有未回传的本地写入（业务 `syncQueue` 或偏好队列）⇒ **阻塞**，
 *   绝不静默丢弃（`blocked` 由调用方给出可见告知 + 先同步）；
 * - **不删** `${userId}:key-bundle`（C-51 唯一不可逆开关，同 origin 的 desktop 可能仍需）；
 * - 丢弃后**重置同步游标 + 镜像新鲜度** ⇒ 下次 `syncService.start()` 为**全量重拉**；
 * - 自愈**直写表**，不经仓储 ⇒ 不 `markDirty`、不入队（避免用空值/默认值反向覆盖服务端）。
 */

/** 自愈结果（调用方据此给出可见告知） */
export type LegacyCipherSelfHealOutcome =
    /** 无残留（纯 web：零行为变化） */
    | { action: 'none' }
    /** 已丢弃本地密文副本 + 重置镜像（等待全量重拉） */
    | { action: 'healed' }
    /** 有未回传本地写入 ⇒ 阻塞（不得丢弃），`pending` = 待回传项数 */
    | { action: 'blocked'; pending: number }

/**
 * 一次性自愈当前用户的旧密文残留（幂等；无残留时零副作用）
 * @param userId 用户 ID
 */
export const selfHealLegacyCipherMirror = async (
    userId: string
): Promise<LegacyCipherSelfHealOutcome> => {
    if (!userId) return { action: 'none' }
    if (!(await hasLegacyCipherResidue(userId))) return { action: 'none' }

    // 护栏（C-54 同口径 + 偏好队列）：宁可阻塞，不得静默丢弃未回传写入
    const dirty = await syncTracker.countDirty(userId)
    const pendingPreferences = (await loadPreferenceQueue(userId)).length
    const pending = dirty + pendingPreferences
    if (pending > 0) {
        logStructured('warn', STRUCTURED_LOG_EVENTS.LEGACY_CIPHER_SELF_HEAL_BLOCKED, {
            userId,
            pending
        })
        return { action: 'blocked', pending }
    }

    // 丢弃本地密文副本（按 userId 过滤，禁跨用户、禁整库清）+ 重置游标 + 写完成标记（单事务）
    await localDatabase.transaction(
        'rw',
        [...LEGACY_CIPHER_TABLES, 'syncCursor', 'meta'],
        async () => {
            for (const table of LEGACY_CIPHER_TABLES) {
                await localDatabase.table(table).where('userId').equals(userId).delete()
            }
            await localDatabase.syncCursor.where('userId').equals(userId).delete()
            // C-51：meta 只写完成标记，**不得**按 `${userId}:` 前缀清（会删掉 key-bundle）
            await localDatabase.meta.put({
                id: plaintextMigrationMarkerId(userId),
                migratedAt: new Date().toISOString()
            } satisfies MetaRecord)
        }
    )
    // 丢弃后镜像不再新鲜：重置落盘新鲜度 ⇒ 重拉完成前不得显示「数据截至 X」
    await saveMirrorStatus(userId, { mirrorPulledAt: null, mirrorTruncated: false })
    logStructured('info', STRUCTURED_LOG_EVENTS.LEGACY_CIPHER_SELF_HEALED, {
        userId,
        tables: LEGACY_CIPHER_TABLES.length
    })
    return { action: 'healed' }
}