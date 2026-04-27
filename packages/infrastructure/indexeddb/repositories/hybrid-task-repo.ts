import type { TaskRepository } from '@nao-todo/domain/task';
import type { GoAsync, ResponseDataPagination } from '@nao-todo/types';
import { TaskEntity } from '@nao-todo/domain/task/entities';
import { CreateTaskValueObject, UpdateTaskValueObject } from '@nao-todo/domain/task/valueobjects';
import { indexedDBTaskRepository } from './task-repo';
import { useTaskRepository } from '../../backend/task/repoImpl';
import { getRequesterImpl } from '../../requester';
import { syncQueue } from '../sync-queue';
import { syncService } from '../../sync/sync-service';
import { taskEntityToViewObject, taskViewObjectToEntity } from '@nao-todo/application/web/converters/task';

class HybridTaskRepository implements TaskRepository {
  private backendRepo = useTaskRepository(getRequesterImpl());

  async get(taskId: string): GoAsync<TaskEntity> {
    try {
      const localTask = await indexedDBTaskRepository.findById(taskId);

      if (localTask) {
        this.fetchLatestTask(taskId);
        return [taskViewObjectToEntity(localTask), null];
      }

      const [taskEntity, error] = await this.backendRepo.get(taskId);

      if (error) {
        return [null, error];
      }

      if (taskEntity) {
        const taskViewObject = taskEntityToViewObject(taskEntity);
        await indexedDBTaskRepository.create({
          ...taskViewObject,
          _syncStatus: 'synced',
          _lastSyncedAt: new Date().toISOString(),
        });
      }

      return [taskEntity, null];
    } catch (error) {
      console.error('Get task error:', error);
      return [null, error instanceof Error ? error.message : 'Unknown error'];
    }
  }

  async create(createTaskValueObject: CreateTaskValueObject): GoAsync<TaskEntity> {
    try {
      const taskViewObject = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parentTaskId: null,
        name: createTaskValueObject.name,
        description: createTaskValueObject.description,
        state: createTaskValueObject.state.toString(),
        priority: createTaskValueObject.priority.toString(),
        startAt: createTaskValueObject.startAt,
        endAt: createTaskValueObject.endAt,
        tags: createTaskValueObject.tags || [],
        projectId: createTaskValueObject.projectId,
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false,
      };

      const savedTask = await indexedDBTaskRepository.create({
        ...taskViewObject,
        _syncStatus: 'local',
        _lastSyncedAt: new Date().toISOString(),
      });

      await syncQueue.addOperation({
        entityType: 'task',
        operationType: 'create',
        entityId: savedTask.id,
        data: taskViewObject,
        status: 'pending',
      });

      syncService.syncNow();

      return [taskViewObjectToEntity(savedTask), null];
    } catch (error) {
      console.error('Create task error:', error);
      return [null, error instanceof Error ? error.message : 'Unknown error'];
    }
  }

  async update(taskId: string, updateTaskValueObject: UpdateTaskValueObject): GoAsync<string> {
    try {
      const localTask = await indexedDBTaskRepository.findById(taskId);

      if (!localTask) {
        const [taskEntity, error] = await this.backendRepo.get(taskId);
        if (error) {
          return [null, error];
        }
        if (taskEntity) {
          const taskViewObject = taskEntityToViewObject(taskEntity);
          await indexedDBTaskRepository.create({
            ...taskViewObject,
            _syncStatus: 'synced',
            _lastSyncedAt: new Date().toISOString(),
          });
        }
      }

      const updatedTask = await indexedDBTaskRepository.update(taskId, {
        name: updateTaskValueObject.name,
        description: updateTaskValueObject.description,
        state: updateTaskValueObject.state?.toString(),
        priority: updateTaskValueObject.priority?.toString(),
        startAt: updateTaskValueObject.startAt,
        endAt: updateTaskValueObject.endAt,
        projectId: updateTaskValueObject.projectId,
        tags: updateTaskValueObject.tags,
        _syncStatus: 'local',
      });

      await syncQueue.addOperation({
        entityType: 'task',
        operationType: 'update',
        entityId: taskId,
        data: {
          name: updateTaskValueObject.name,
          description: updateTaskValueObject.description,
          state: updateTaskValueObject.state?.toString(),
          priority: updateTaskValueObject.priority?.toString(),
          startAt: updateTaskValueObject.startAt,
          endAt: updateTaskValueObject.endAt,
          projectId: updateTaskValueObject.projectId,
          tags: updateTaskValueObject.tags,
        },
        status: 'pending',
      });

      syncService.syncNow();

      return [taskId, null];
    } catch (error) {
      console.error('Update task error:', error);
      return [null, error instanceof Error ? error.message : 'Unknown error'];
    }
  }

  async remove(taskId: string): GoAsync<void> {
    try {
      const localTask = await indexedDBTaskRepository.findById(taskId);

      if (localTask) {
        await indexedDBTaskRepository.update(taskId, {
          deletedAt: new Date().toISOString(),
          isDeleted: true,
          _syncStatus: 'local',
        });
      }

      await syncQueue.addOperation({
        entityType: 'task',
        operationType: 'delete',
        entityId: taskId,
        data: {},
        status: 'pending',
      });

      syncService.syncNow();

      return null;
    } catch (error) {
      console.error('Remove task error:', error);
      return error instanceof Error ? error.message : 'Unknown error';
    }
  }

  async restore(taskId: string): GoAsync<void> {
    try {
      const localTask = await indexedDBTaskRepository.findById(taskId);

      if (localTask) {
        await indexedDBTaskRepository.update(taskId, {
          deletedAt: null,
          isDeleted: false,
          _syncStatus: 'local',
        });
      }

      const error = await this.backendRepo.restore(taskId);

      if (error) {
        return error;
      }

      if (localTask) {
        await indexedDBTaskRepository.updateSyncStatus(taskId, 'synced');
      }

      return null;
    } catch (error) {
      console.error('Restore task error:', error);
      return error instanceof Error ? error.message : 'Unknown error';
    }
  }

  async list(queryString?: string): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> {
    try {
      const localTasks = await indexedDBTaskRepository.findAll();

      if (localTasks.length > 0) {
        this.fetchLatestTasks(queryString);

        const taskEntities = localTasks.map(taskViewObjectToEntity);
        return [{ taskEntities, pagination: { total: taskEntities.length, page: 1, limit: taskEntities.length, maxPage: 1 } }, null];
      }

      const [result, error] = await this.backendRepo.list(queryString);

      if (error) {
        return [null, error];
      }

      if (result) {
        const { taskEntities, pagination } = result;

        for (const taskEntity of taskEntities) {
          const taskViewObject = taskEntityToViewObject(taskEntity);
          await indexedDBTaskRepository.create({
            ...taskViewObject,
            _syncStatus: 'synced',
            _lastSyncedAt: new Date().toISOString(),
          });
        }

        return [result, null];
      }

      return [{ taskEntities: [], pagination: { total: 0, page: 1, limit: 20, maxPage: 1 } }, null];
    } catch (error) {
      console.error('List tasks error:', error);
      return [null, error instanceof Error ? error.message : 'Unknown error'];
    }
  }

  private async fetchLatestTask(taskId: string): Promise<void> {
    try {
      const [taskEntity, error] = await this.backendRepo.get(taskId);

      if (error || !taskEntity) {
        return;
      }

      const taskViewObject = taskEntityToViewObject(taskEntity);
      const localTask = await indexedDBTaskRepository.findById(taskId);

      if (localTask) {
        if (new Date(taskViewObject.updatedAt) > new Date(localTask.updatedAt)) {
          await indexedDBTaskRepository.update(taskId, {
            ...taskViewObject,
            _syncStatus: 'synced',
            _lastSyncedAt: new Date().toISOString(),
          });
        }
      } else {
        await indexedDBTaskRepository.create({
          ...taskViewObject,
          _syncStatus: 'synced',
          _lastSyncedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Fetch latest task error:', error);
    }
  }

  private async fetchLatestTasks(queryString?: string): Promise<void> {
    try {
      const [result, error] = await this.backendRepo.list(queryString);

      if (error || !result) {
        return;
      }

      const { taskEntities } = result;

      for (const taskEntity of taskEntities) {
        const taskViewObject = taskEntityToViewObject(taskEntity);
        const localTask = await indexedDBTaskRepository.findById(taskEntity.id);

        if (localTask) {
          if (new Date(taskViewObject.updatedAt) > new Date(localTask.updatedAt)) {
            await indexedDBTaskRepository.update(taskEntity.id, {
              ...taskViewObject,
              _syncStatus: 'synced',
              _lastSyncedAt: new Date().toISOString(),
            });
          }
        } else {
          await indexedDBTaskRepository.create({
            ...taskViewObject,
            _syncStatus: 'synced',
            _lastSyncedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Fetch latest tasks error:', error);
    }
  }
}

export const hybridTaskRepository = new HybridTaskRepository();
export default hybridTaskRepository;
