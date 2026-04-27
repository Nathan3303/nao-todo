import type { ConflictResolver } from '../indexeddb/types';

class LastWriteWinsConflictResolver implements ConflictResolver {
  /**
   * 解决冲突
   * 采用 Last Write Wins 策略，基于 updatedAt 时间戳
   * @param localData 本地数据
   * @param remoteData 远程数据
   * @returns 解决后的最终数据
   */
  async resolveConflict(localData: any, remoteData: any): Promise<any> {
    try {
      // 解析时间戳
      const localUpdatedAt = this.parseTimestamp(localData.updatedAt);
      const remoteUpdatedAt = this.parseTimestamp(remoteData.updatedAt);

      // 比较时间戳
      if (localUpdatedAt > remoteUpdatedAt) {
        // 本地数据更新较晚，使用本地数据
        console.log('Conflict resolved: Using local data (last write wins)');
        return {
          ...localData,
          _syncStatus: 'synced' as const,
          _lastSyncedAt: new Date().toISOString(),
        };
      } else {
        // 远程数据更新较晚，使用远程数据
        console.log('Conflict resolved: Using remote data (last write wins)');
        return {
          ...remoteData,
          _syncStatus: 'synced' as const,
          _lastSyncedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error('Conflict resolution error:', error);
      // 出错时默认使用远程数据
      return {
        ...remoteData,
        _syncStatus: 'synced' as const,
        _lastSyncedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 解析时间戳
   * @param timestamp 时间戳字符串
   * @returns 时间戳数值
   */
  private parseTimestamp(timestamp: string): number {
    if (!timestamp) {
      return 0;
    }

    const date = new Date(timestamp);
    return date.getTime();
  }

  /**
   * 检测是否存在冲突
   * @param localData 本地数据
   * @param remoteData 远程数据
   * @returns 是否存在冲突
   */
  detectConflict(localData: any, remoteData: any): boolean {
    if (!localData || !remoteData) {
      return false;
    }

    // 比较 updatedAt 时间戳
    const localUpdatedAt = this.parseTimestamp(localData.updatedAt);
    const remoteUpdatedAt = this.parseTimestamp(remoteData.updatedAt);

    // 检查是否有一方有更新
    return localUpdatedAt > 0 && remoteUpdatedAt > 0 && localUpdatedAt !== remoteUpdatedAt;
  }

  /**
   * 记录冲突日志
   * @param localData 本地数据
   * @param remoteData 远程数据
   * @param resolvedData 解决后的数据
   */
  logConflict(localData: any, remoteData: any, resolvedData: any): void {
    console.log('Conflict detected:', {
      localId: localData.id,
      localUpdatedAt: localData.updatedAt,
      remoteId: remoteData.id,
      remoteUpdatedAt: remoteData.updatedAt,
      resolvedWith: resolvedData.updatedAt === localData.updatedAt ? 'local' : 'remote',
    });

    // 可以在这里添加更详细的日志记录，例如存储到 IndexedDB 或发送到服务器
  }
}

export const conflictResolver = new LastWriteWinsConflictResolver();
export default conflictResolver;
