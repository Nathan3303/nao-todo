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

    /** 推送失败：retryCount 自增（记录最近失败时间） */
    async markFailed(id: string): Promise<void> {
        const record = await localDatabase.syncQueue.get(id)
        if (record) {
            record.retryCount += 1
            record.updatedAt = new Date().toISOString()
            await localDatabase.syncQueue.put(record)
        }
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