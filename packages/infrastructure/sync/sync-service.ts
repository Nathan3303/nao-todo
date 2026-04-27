import { syncQueue } from '../indexeddb/sync-queue';
import { indexedDBTaskRepository } from '../indexeddb/repositories/task-repo';
import type { SyncOperation, SyncService } from '../indexeddb/types';
import { useTaskRepository } from '../backend/task/repoImpl';
import { getRequesterImpl } from '../requester';
import { taskEntityToViewObject } from '@nao-todo/application/web/converters/task';

class IndexedDBSyncService implements SyncService {
  private syncInterval: number | null = null;
  private isSyncing = false;
  private taskRepository = useTaskRepository(getRequesterImpl());

  startSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = window.setInterval(async () => {
      await this.syncNow();
    }, 30000);

    window.addEventListener('online', async () => {
      await this.syncNow();
    });
  }

  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    window.removeEventListener('online', this.syncNow.bind(this));
  }

  async syncNow(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      const pendingOperations = await syncQueue.getPendingOperations();

      for (const operation of pendingOperations) {
        await this.processOperation(operation);
      }

      await syncQueue.clearCompletedOperations();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  async getSyncStatus(): Promise<{ isSyncing: boolean; pendingCount: number }> {
    const pendingOperations = await syncQueue.getPendingOperations();
    return {
      isSyncing: this.isSyncing,
      pendingCount: pendingOperations.length,
    };
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    try {
      await syncQueue.updateOperationStatus(operation.id, 'syncing');

      switch (operation.operationType) {
        case 'create':
          await this.syncCreate(operation);
          break;
        case 'update':
          await this.syncUpdate(operation);
          break;
        case 'delete':
          await this.syncDelete(operation);
          break;
      }

      await syncQueue.updateOperationStatus(operation.id, 'completed');
    } catch (error) {
      console.error(`Sync operation failed:`, error);
      await syncQueue.updateOperationStatus(
        operation.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async syncCreate(operation: SyncOperation): Promise<void> {
    const { data } = operation;

    const [taskEntity, error] = await this.taskRepository.create({
      projectId: data.projectId,
      name: data.name,
      description: data.description || '',
      state: parseInt(data.state),
      priority: parseInt(data.priority),
      startAt: data.startAt || '',
      endAt: data.endAt || '',
      tags: data.tags || [],
    });

    if (error) {
      throw new Error(error);
    }

    if (taskEntity) {
      await indexedDBTaskRepository.replaceLocalId(operation.entityId, taskEntity.id);
    }
  }

  private async syncUpdate(operation: SyncOperation): Promise<void> {
    const { entityId, data } = operation;

    const [result, error] = await this.taskRepository.update(entityId, {
      projectId: data.projectId,
      name: data.name,
      description: data.description,
      state: data.state ? parseInt(data.state) : undefined,
      priority: data.priority ? parseInt(data.priority) : undefined,
      startAt: data.startAt,
      endAt: data.endAt,
      tags: data.tags,
    });

    if (error) {
      throw new Error(error);
    }

    if (result) {
      await indexedDBTaskRepository.updateSyncStatus(entityId, 'synced');
    }
  }

  private async syncDelete(operation: SyncOperation): Promise<void> {
    const { entityId } = operation;

    const error = await this.taskRepository.remove(entityId);

    if (error) {
      throw new Error(error);
    }

    await indexedDBTaskRepository.delete(entityId);
  }

  async syncAllTasks(): Promise<void> {
    try {
      const [result, error] = await this.taskRepository.list('');

      if (error) {
        throw new Error(error);
      }

      if (result) {
        const { taskEntities } = result;

        await indexedDBTaskRepository.clear();

        for (const taskEntity of taskEntities) {
          const taskViewObject = taskEntityToViewObject(taskEntity);
          await indexedDBTaskRepository.create({
            ...taskViewObject,
            _syncStatus: 'synced',
            _lastSyncedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Sync all tasks error:', error);
      throw error;
    }
  }
}

export const syncService = new IndexedDBSyncService();
export default syncService;
