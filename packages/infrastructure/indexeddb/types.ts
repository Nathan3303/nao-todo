export type SyncStatus = 'local' | 'syncing' | 'synced' | 'conflict';

export type SyncOperationStatus = 'pending' | 'syncing' | 'failed' | 'completed';

export type OperationType = 'create' | 'update' | 'delete';

export type EntityType = 'task';

export interface IndexedDBEntity {
  _localId?: string;
  _syncStatus: SyncStatus;
  _lastSyncedAt?: string;
}

export interface SyncOperation {
  id: string;
  entityType: EntityType;
  operationType: OperationType;
  entityId: string;
  data: any;
  status: SyncOperationStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  error?: string;
}

export interface IndexedDBRepository<T> {
  create(item: T): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  findByQuery(query: Record<string, any>): Promise<T[]>;
  clear(): Promise<void>;
}

export interface SyncQueue {
  addOperation(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'updatedAt' | 'retryCount'>): Promise<SyncOperation>;
  getPendingOperations(): Promise<SyncOperation[]>;
  updateOperationStatus(id: string, status: SyncOperationStatus, error?: string): Promise<void>;
  deleteOperation(id: string): Promise<void>;
  clearCompletedOperations(): Promise<void>;
}

export interface SyncService {
  startSync(): void;
  stopSync(): void;
  syncNow(): Promise<void>;
  getSyncStatus(): Promise<{ isSyncing: boolean; pendingCount: number }>;
}

export interface ConflictResolver {
  resolveConflict(localData: any, remoteData: any): Promise<any>;
}
