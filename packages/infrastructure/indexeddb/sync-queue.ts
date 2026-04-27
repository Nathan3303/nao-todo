import { indexedDBClient, type SyncOperationStore } from './db';
import type { SyncOperation, SyncQueue, SyncOperationStatus } from './types';
import { v4 as uuidv4 } from 'uuid';

class IndexedDBSyncQueue implements SyncQueue {
  async addOperation(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'updatedAt' | 'retryCount'>): Promise<SyncOperation> {
    const store = await indexedDBClient.getSyncStore();

    const syncOperation: SyncOperation = {
      ...operation,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(syncOperation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return syncOperation;
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    const store = await indexedDBClient.getSyncStore();

    return new Promise((resolve, reject) => {
      const index = store.index('status');
      const request = index.openCursor('pending');
      const operations: SyncOperation[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          operations.push(cursor.value);
          cursor.continue();
        } else {
          resolve(operations);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async updateOperationStatus(id: string, status: SyncOperationStatus, error?: string): Promise<void> {
    const store = await indexedDBClient.getSyncStore();

    const operation = await this.findById(id);
    if (!operation) {
      throw new Error(`Sync operation with id ${id} not found`);
    }

    const updatedOperation = {
      ...operation,
      status,
      error,
      updatedAt: new Date().toISOString(),
      retryCount: status === 'failed' ? (operation.retryCount + 1) : operation.retryCount,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(updatedOperation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteOperation(id: string): Promise<void> {
    const store = await indexedDBClient.getSyncStore();

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearCompletedOperations(): Promise<void> {
    const store = await indexedDBClient.getSyncStore();

    return new Promise((resolve, reject) => {
      const index = store.index('status');
      const request = index.openCursor('completed');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async findById(id: string): Promise<SyncOperation | null> {
    const store = await indexedDBClient.getSyncStore();

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllOperations(): Promise<SyncOperation[]> {
    const store = await indexedDBClient.getSyncStore();

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getOperationsByEntityId(entityId: string): Promise<SyncOperation[]> {
    const store = await indexedDBClient.getSyncStore();

    return new Promise((resolve, reject) => {
      const index = store.index('entityId');
      const request = index.openCursor(entityId);
      const operations: SyncOperation[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          operations.push(cursor.value);
          cursor.continue();
        } else {
          resolve(operations);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    const store = await indexedDBClient.getSyncStore();

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const syncQueue = new IndexedDBSyncQueue();
export default syncQueue;
