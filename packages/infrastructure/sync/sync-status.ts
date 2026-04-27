import { syncService } from './sync-service';
import { syncQueue } from '../indexeddb/sync-queue';

interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime?: string;
  syncError?: string;
}

class SyncStatusManager {
  private status: SyncStatus = {
    isSyncing: false,
    pendingCount: 0,
  };
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.updateStatus();
  }

  /**
   * 更新同步状态
   */
  async updateStatus(): Promise<void> {
    try {
      const syncStatus = await syncService.getSyncStatus();
      const pendingOperations = await syncQueue.getPendingOperations();

      this.status = {
        isSyncing: syncStatus.isSyncing,
        pendingCount: pendingOperations.length,
        lastSyncTime: new Date().toISOString(),
      };

      this.notifyListeners();
    } catch (error) {
      console.error('Update sync status error:', error);
      this.status.syncError = error instanceof Error ? error.message : 'Unknown error';
      this.notifyListeners();
    }
  }

  /**
   * 获取当前同步状态
   * @returns 当前同步状态
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * 订阅同步状态变化
   * @param listener 状态变化监听器
   * @returns 取消订阅函数
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);

    // 立即通知当前状态
    listener(this.getStatus());

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有监听器状态变化
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.getStatus());
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    }
  }

  /**
   * 手动触发同步并更新状态
   */
  async triggerSync(): Promise<void> {
    await syncService.syncNow();
    await this.updateStatus();
  }

  /**
   * 检查是否有未同步的操作
   * @returns 是否有未同步的操作
   */
  async hasPendingSync(): Promise<boolean> {
    const pendingOperations = await syncQueue.getPendingOperations();
    return pendingOperations.length > 0;
  }

  /**
   * 获取未同步操作的数量
   * @returns 未同步操作的数量
   */
  async getPendingCount(): Promise<number> {
    const pendingOperations = await syncQueue.getPendingOperations();
    return pendingOperations.length;
  }
}

export const syncStatusManager = new SyncStatusManager();
export default syncStatusManager;
