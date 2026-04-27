const DB_NAME = 'nao-todo';
const DB_VERSION = 1;

interface IDBOpenDBRequestWithPromise extends IDBOpenDBRequest {
  promise: Promise<IDBDatabase>;
}

export interface TaskStore {
  id: string;
  parentTaskId: string | null;
  name: string;
  description: string | null;
  state: string;
  priority: string;
  startAt: string | null;
  endAt: string | null;
  tags: string[];
  projectId: string | null;
  archivedAt: string | null;
  starMarkAt: string | null;
  givenUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _localId?: string;
  _syncStatus: 'local' | 'syncing' | 'synced' | 'conflict';
  _lastSyncedAt?: string;
}

export interface SyncOperationStore {
  id: string;
  entityType: 'task';
  operationType: 'create' | 'update' | 'delete';
  entityId: string;
  data: any;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  error?: string;
}

class IndexedDBClient {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.openPromise) {
      return this.openPromise;
    }

    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION) as IDBOpenDBRequestWithPromise;

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('projectId', 'projectId', { unique: false });
          taskStore.createIndex('state', 'state', { unique: false });
          taskStore.createIndex('priority', 'priority', { unique: false });
        }

        if (!db.objectStoreNames.contains('syncOperations')) {
          const syncStore = db.createObjectStore('syncOperations', { keyPath: 'id' });
          syncStore.createIndex('entityId', 'entityId', { unique: false });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.openPromise;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.openPromise = null;
    }
  }

  async getTaskStore(): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction('tasks', 'readwrite').objectStore('tasks');
  }

  async getSyncStore(): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction('syncOperations', 'readwrite').objectStore('syncOperations');
  }

  async clearAll(): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['tasks', 'syncOperations'], 'readwrite');

    await new Promise<void>((resolve, reject) => {
      const taskRequest = transaction.objectStore('tasks').clear();
      taskRequest.onsuccess = () => {
        const syncRequest = transaction.objectStore('syncOperations').clear();
        syncRequest.onsuccess = () => resolve();
        syncRequest.onerror = () => reject(syncRequest.error);
      };
      taskRequest.onerror = () => reject(taskRequest.error);
    });
  }
}

export const indexedDBClient = new IndexedDBClient();
export default indexedDBClient;
