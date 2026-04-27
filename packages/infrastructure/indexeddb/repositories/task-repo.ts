import { indexedDBClient, type TaskStore } from '../db';
import type { IndexedDBRepository, SyncStatus } from '../types';
import type { TaskViewObject } from '@nao-todo/types';
import { v4 as uuidv4 } from 'uuid';

class IndexedDBTaskRepository implements IndexedDBRepository<TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string }> {
  async create(item: TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string }): Promise<TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string }> {
    const store = await indexedDBClient.getTaskStore();

    const taskWithDefaults = {
      ...item,
      id: item.id || `local_${uuidv4()}`,
      _localId: item._localId || item.id,
      _syncStatus: item._syncStatus || 'local',
      _lastSyncedAt: item._lastSyncedAt || new Date().toISOString(),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      deletedAt: item.deletedAt || null,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(taskWithDefaults);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return taskWithDefaults;
  }

  async update(id: string, item: Partial<TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string }>): Promise<TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string }> {
    const store = await indexedDBClient.getTaskStore();
    const existingTask = await this.findById(id);

    if (!existingTask) {
      throw new Error(`Task with id ${id} not found`);
    }

    const updatedTask = {
      ...existingTask,
      ...item,
      updatedAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(updatedTask);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return updatedTask;
  }

  async delete(id: string): Promise<void> {
    const store = await indexedDBClient.getTaskStore();

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async findById(id: string): Promise<TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string } | null> {
    const store = await indexedDBClient.getTaskStore();

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async findAll(): Promise<Array<TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string }>> {
    const store = await indexedDBClient.getTaskStore();

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async findByQuery(query: Record<string, any>): Promise<Array<TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string }>> {
    const allTasks = await this.findAll();

    return allTasks.filter(task => {
      return Object.entries(query).every(([key, value]) => {
        if (key === 'isDeleted') {
          return !!task.deletedAt === value;
        }
        if (key === 'isArchived') {
          return !!task.archivedAt === value;
        }
        if (key === 'isStarMarked') {
          return !!task.starMarkAt === value;
        }
        if (key === 'isGivenUp') {
          return !!task.givenUpAt === value;
        }
        return task[key as keyof TaskViewObject] === value;
      });
    });
  }

  async clear(): Promise<void> {
    const store = await indexedDBClient.getTaskStore();

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateSyncStatus(id: string, status: SyncStatus): Promise<void> {
    await this.update(id, { _syncStatus: status, _lastSyncedAt: new Date().toISOString() });
  }

  async findByLocalId(localId: string): Promise<TaskViewObject & { _syncStatus: SyncStatus; _localId?: string; _lastSyncedAt?: string } | null> {
    const allTasks = await this.findAll();
    return allTasks.find(task => task._localId === localId) || null;
  }

  async replaceLocalId(localId: string, serverId: string): Promise<void> {
    const task = await this.findByLocalId(localId);
    if (task) {
      await this.delete(localId);
      await this.create({
        ...task,
        id: serverId,
        _localId: serverId,
        _syncStatus: 'synced',
      });
    }
  }
}

export const indexedDBTaskRepository = new IndexedDBTaskRepository();
export default indexedDBTaskRepository;
