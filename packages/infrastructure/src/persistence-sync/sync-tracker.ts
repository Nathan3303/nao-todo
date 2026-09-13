/**
 * 脏实体追踪器
 * @description 本地仓储写成功后登记 syncQueue（主键 `${userId}:${table}:${entityId}` 去重，
 *              同实体重复写合并为最新版本）；拉取写入路径不经过 markDirty（避免同步回环）。
 *              projectPreferences/tagPreferences 随父实体同步，不入队（见 data-sync-plan.md §1.3）。
 */
import {
    localDatabase,
    type SyncAction,
    type SyncQueueRecord
} from '../persistence-local/db/local-database'
import { localSession } from '../persistence-local/session/local-session'
import { backoffDelayMs, isRetryDue } from './sync-retry'

export class SyncTracker {
    /** 脏写入回调（装配层注入：触发 syncService.schedulePush 防抖推送） */
    private dirtyListener: (() => void) | null = null

    setDirtyListener(listener: () => void): void {
        this.dirtyListener = listener
    }

    /**
     * 登记脏实体（本地仓储 create/update/remove/restore 成功后调用）
     * @param table 表名（如 'tasks'）
     * @param entityId 实体 id
     * @param action 动作（upsert/delete）
     * @param updatedAt 本地实体 updatedAt（删除时为 deletedAt）
     */
    async markDirty(
        table: string,
        entityId: string,
        action: SyncAction,
        updatedAt: string
    ): Promise<void> {
        const userId = localSession.getCurrentUserId()
        if (!userId) return // 无会话（未登录/测试环境）不登记
        const now = new Date().toISOString()
        const id = `${userId}:${table}:${entityId}`
        // 同实体重复写合并：保留首次入队时间与既有重试计数
        const existing = await localDatabase.syncQueue.get(id)
        await localDatabase.syncQueue.put({
            id,
            userId,
            table,
            entityId,
            action,
            localUpdatedAt: updatedAt,
            retryCount: existing?.retryCount ?? 0,
            // SHELL-06 C-44：同实体重写保留退避进度（不重置 attempts/nextAttemptAt）
            attempts: existing?.attempts,
            nextAttemptAt: existing?.nextAttemptAt,
            lastErrorClass: existing?.lastErrorClass,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now
        })
        // 变更后触发防抖推送（2s 合并，见 data-sync-plan.md §4.2）
        this.dirtyListener?.()
    }

    /** 移除队列项（推送成功或本地被远程覆盖时） */
    async removeQueued(table: string, entityId: string): Promise<void> {
        const userId = localSession.getCurrentUserId()
        if (!userId) return
        await localDatabase.syncQueue.delete(`${userId}:${table}:${entityId}`)
    }

    /**
     * 业务/数据类推送失败：计数 +1 并写下次可推时间（SHELL-06 C-39）
     * @description 网络类失败**不得**调用本方法（C-38：网络类只暂停、不计数）
     */
    async markBusinessFailure(id: string, nextAttemptAt: string): Promise<void> {
        const record = await localDatabase.syncQueue.get(id)
        if (!record) return
        const attempts = (record.attempts ?? record.retryCount ?? 0) + 1
        record.attempts = attempts
        record.retryCount = attempts
        record.nextAttemptAt = nextAttemptAt
        record.lastErrorClass = 'business'
        record.updatedAt = new Date().toISOString()
        await localDatabase.syncQueue.put(record)
    }

    /** 推送失败（业务/数据类）：按指数退避写入 nextAttemptAt */
    async markFailed(id: string): Promise<void> {
        const record = await localDatabase.syncQueue.get(id)
        if (!record) return
        const attempts = (record.attempts ?? record.retryCount ?? 0) + 1
        const nextAt = new Date(Date.now() + backoffDelayMs(attempts)).toISOString()
        await this.markBusinessFailure(id, nextAt)
    }

    /**
     * 触顶/暂停恢复：清退避与失败分类，使所有项重新入列（SHELL-06 C-42；含删除项）
     * @returns 重置的队列项数
     */
    async resetFailed(userId?: string): Promise<number> {
        const uid = userId ?? localSession.getCurrentUserId()
        if (!uid) return 0
        const records = await localDatabase.syncQueue.where('userId').equals(uid).toArray()
        let reset = 0
        for (const record of records) {
            if (!record.nextAttemptAt && !record.lastErrorClass) continue
            record.nextAttemptAt = null
            delete record.lastErrorClass
            record.updatedAt = new Date().toISOString()
            await localDatabase.syncQueue.put(record)
            reset += 1
        }
        return reset
    }

    /** 当前用户队列按表计数（SHELL-06 C-41 上限可见性） */
    async countByTable(userId?: string): Promise<Map<string, number>> {
        const uid = userId ?? localSession.getCurrentUserId()
        const counts = new Map<string, number>()
        if (!uid) return counts
        const records = await localDatabase.syncQueue.where('userId').equals(uid).toArray()
        for (const record of records) counts.set(record.table, (counts.get(record.table) ?? 0) + 1)
        return counts
    }

    /** 当前用户可推送就绪数量（不含退避未到期项） */
    async countDue(userId?: string, nowMs = Date.now()): Promise<number> {
        const uid = userId ?? localSession.getCurrentUserId()
        if (!uid) return 0
        const records = await localDatabase.syncQueue.where('userId').equals(uid).toArray()
        return records.filter((record) => isRetryDue(record, nowMs)).length
    }

    /** 当前用户处于退避未到期的项数（SHELL-06 C-41 暂停可见性） */
    async countPaused(userId?: string, nowMs = Date.now()): Promise<number> {
        const uid = userId ?? localSession.getCurrentUserId()
        if (!uid) return 0
        const records = await localDatabase.syncQueue.where('userId').equals(uid).toArray()
        return records.filter((record) => !isRetryDue(record, nowMs)).length
    }

    /** 查询当前用户（或指定用户）脏队列，按入队时间升序 */
    async listDirty(userId?: string): Promise<SyncQueueRecord[]> {
        const uid = userId ?? localSession.getCurrentUserId()
        if (!uid) return []
        return localDatabase.syncQueue.where('userId').equals(uid).sortBy('createdAt')
    }

    /** 当前用户待推送数量（供 UI 展示） */
    async countDirty(userId?: string): Promise<number> {
        const uid = userId ?? localSession.getCurrentUserId()
        if (!uid) return 0
        return localDatabase.syncQueue.where('userId').equals(uid).count()
    }

    /** 当前用户推送失败数量（retryCount > 0，含超限暂停项） */
    async countFailed(userId?: string): Promise<number> {
        const uid = userId ?? localSession.getCurrentUserId()
        if (!uid) return 0
        return localDatabase.syncQueue
            .where('userId')
            .equals(uid)
            .filter((r) => r.retryCount > 0)
            .count()
    }
}

/** 脏实体追踪器单例 */
export const syncTracker = new SyncTracker()