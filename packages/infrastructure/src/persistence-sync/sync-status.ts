/**
 * 同步状态（可观测）
 * @description 供 UI 订阅展示：同步中/上次同步时间/待推送数/失败数/最后错误；
 *              内存态 + 订阅通知（见 data-sync-plan.md §8 Phase 3）。
 */

export interface SyncStatusState {
    /** 是否正在同步（拉取或推送执行中） */
    syncing: boolean
    /** 上次成功同步完成时间（ISO） */
    lastSyncAt: string | null
    /** 待推送实体数（syncQueue 总量） */
    pendingCount: number
    /** 推送失败实体数（retryCount > 0，含超限暂停项） */
    failedCount: number
    /** 最近一次错误信息 */
    lastError: string | null
}

export class SyncStatus {
    private state: SyncStatusState = {
        syncing: false,
        lastSyncAt: null,
        pendingCount: 0,
        failedCount: 0,
        lastError: null
    }

    private listeners = new Set<() => void>()

    /** 获取当前状态快照 */
    get(): SyncStatusState {
        return { ...this.state }
    }

    /** 订阅状态变更（返回取消订阅函数） */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    /** 内部更新 + 通知 */
    private set(partial: Partial<SyncStatusState>): void {
        this.state = { ...this.state, ...partial }
        for (const listener of this.listeners) listener()
    }

    /** 同步开始 */
    markSyncing(): void {
        this.set({ syncing: true, lastError: null })
    }

    /** 同步结束（成功或失败） */
    markSynced(
        partial: Partial<Pick<SyncStatusState, 'pendingCount' | 'failedCount' | 'lastError'>>
    ): void {
        this.set({
            syncing: false,
            lastSyncAt: new Date().toISOString(),
            ...partial
        })
    }
}

/** 同步状态单例 */
export const syncStatus = new SyncStatus()