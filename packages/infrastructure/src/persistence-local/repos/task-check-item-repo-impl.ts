import {
    CreateTaskCheckItemValueObject,
    TaskCheckItemEntity,
    TaskCheckItemRepository,
    UpdateTaskCheckItemValueObject
} from '@nao-todo/domain-task'
import type { GoAsync } from '@nao-todo/shared'
import { taskCheckItemEntityToRecord, taskCheckItemRecordToEntity } from '../converters/task'
import { isNotDeleted } from '../utils'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { snowflake } from '../../persistence-sync/snowflake'
import { syncTracker } from '../../persistence-sync/sync-tracker'

/**
 * 本地任务检查项仓储实现
 */
export class LocalTaskCheckItemRepoImpl implements TaskCheckItemRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async get(id: string): GoAsync<TaskCheckItemEntity> {
        try {
            const record = await this.db.taskCheckItems.get(id)
            if (!record || record.userId !== this.currentUserId) return [null, '检查项不存在']
            return [await taskCheckItemRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreateTaskCheckItemValueObject): GoAsync<TaskCheckItemEntity> {
        try {
            const now = new Date().toISOString()
            // 默认排最后：取该任务下最大 sortId + 1（首个为 1）
            const existing = await this.db.taskCheckItems
                .where('taskId')
                .equals(createVO.taskId)
                .filter((r) => r.userId === this.currentUserId)
                .toArray()
            const maxSortId = existing.reduce((max, r) => Math.max(max, r.sortId), 0)
            const sortId = maxSortId + 1
            const entity = new TaskCheckItemEntity(
                snowflake.nextId(),
                now,
                now,
                null,
                createVO.taskId,
                createVO.name,
                createVO.isDone,
                sortId
            )
            await this.db.taskCheckItems.add(
                await taskCheckItemEntityToRecord(entity, this.currentUserId)
            )
            await syncTracker.markDirty('taskCheckItems', entity.id, 'upsert', entity.updatedAt)
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(id: string, updateVO: UpdateTaskCheckItemValueObject): GoAsync<void> {
        try {
            const record = await this.db.taskCheckItems.get(id)
            if (!record || record.userId !== this.currentUserId) return '检查项不存在'
            const entity = await taskCheckItemRecordToEntity(record)
            if (updateVO.name !== undefined) entity.name = updateVO.name
            if (updateVO.isDone !== undefined) entity.isDone = updateVO.isDone
            if (updateVO.sortId !== undefined) entity.sortId = updateVO.sortId
            entity.updatedAt = new Date().toISOString()
            await this.db.taskCheckItems.put(
                await taskCheckItemEntityToRecord(entity, this.currentUserId)
            )
            await syncTracker.markDirty('taskCheckItems', id, 'upsert', entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async delete(id: string): GoAsync<void> {
        try {
            const record = await this.db.taskCheckItems.get(id)
            if (!record || record.userId !== this.currentUserId) return '检查项不存在'
            const entity = await taskCheckItemRecordToEntity(record)
            entity.deletedAt = new Date().toISOString()
            entity.updatedAt = entity.deletedAt
            await this.db.taskCheckItems.put(
                await taskCheckItemEntityToRecord(entity, this.currentUserId)
            )
            await syncTracker.markDirty(
                'taskCheckItems',
                id,
                'delete',
                entity.deletedAt ?? entity.updatedAt
            )
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(taskId: string): GoAsync<TaskCheckItemEntity[]> {
        try {
            const records = await this.db.taskCheckItems
                .where('taskId')
                .equals(taskId)
                .filter((r) => r.userId === this.currentUserId && isNotDeleted(r.deletedAt))
                .toArray()
            const entities: TaskCheckItemEntity[] = []
            for (const record of records) {
                entities.push(await taskCheckItemRecordToEntity(record))
            }
            entities.sort((a, b) => a.sortId - b.sortId)
            return [entities, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async batchUpdate(updateVOs: UpdateTaskCheckItemValueObject[]): GoAsync<TaskCheckItemEntity[]> {
        try {
            const entities: TaskCheckItemEntity[] = []
            for (const updateVO of updateVOs) {
                const [entity, err] = await this.get(updateVO.id)
                if (err !== null) continue
                const current = entity as TaskCheckItemEntity
                if (updateVO.name !== undefined) current.name = updateVO.name
                if (updateVO.isDone !== undefined) current.isDone = updateVO.isDone
                if (updateVO.sortId !== undefined) current.sortId = updateVO.sortId
                current.updatedAt = new Date().toISOString()
                await this.db.taskCheckItems.put(
                    await taskCheckItemEntityToRecord(current, this.currentUserId)
                )
                await syncTracker.markDirty(
                    'taskCheckItems',
                    current.id,
                    'upsert',
                    current.updatedAt
                )
                entities.push(current)
            }
            return [entities, null]
        } catch (err) {
            return [null, String(err)]
        }
    }
}

/**
 * 创建本地任务检查项仓储实例
 */
export const newLocalTaskCheckItemRepository = () => new LocalTaskCheckItemRepoImpl()