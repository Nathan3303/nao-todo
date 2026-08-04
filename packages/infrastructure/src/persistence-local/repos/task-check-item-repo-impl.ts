import {
    CreateTaskCheckItemValueObject,
    TaskCheckItemEntity,
    TaskCheckItemRepository,
    UpdateTaskCheckItemValueObject
} from '@nao-todo/domain-task'
import type { GoAsync } from '@nao-todo/shared'
import { taskCheckItemEntityToRecord, taskCheckItemRecordToEntity } from '../converters/task'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'

/**
 * 本地任务检查项仓储实现
 */
export class LocalTaskCheckItemRepoImpl implements TaskCheckItemRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    async get(id: string): GoAsync<TaskCheckItemEntity> {
        try {
            const record = await this.db.taskCheckItems.get(id)
            if (!record) return [null, '检查项不存在']
            return [await taskCheckItemRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreateTaskCheckItemValueObject): GoAsync<TaskCheckItemEntity> {
        try {
            const now = new Date().toISOString()
            const entity = new TaskCheckItemEntity(
                crypto.randomUUID(),
                now,
                now,
                null,
                createVO.taskId,
                createVO.name,
                createVO.isDone,
                1
            )
            await this.db.taskCheckItems.add(await taskCheckItemEntityToRecord(entity))
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(id: string, updateVO: UpdateTaskCheckItemValueObject): GoAsync<void> {
        try {
            const record = await this.db.taskCheckItems.get(id)
            if (!record) return '检查项不存在'
            const entity = await taskCheckItemRecordToEntity(record)
            if (updateVO.name !== undefined) entity.name = updateVO.name
            if (updateVO.isDone !== undefined) entity.isDone = updateVO.isDone
            if (updateVO.sortId !== undefined) entity.sortId = updateVO.sortId
            entity.updatedAt = new Date().toISOString()
            await this.db.taskCheckItems.put(await taskCheckItemEntityToRecord(entity))
            return null
        } catch (err) {
            return String(err)
        }
    }

    async delete(id: string): GoAsync<void> {
        try {
            const record = await this.db.taskCheckItems.get(id)
            if (!record) return '检查项不存在'
            const entity = await taskCheckItemRecordToEntity(record)
            entity.deletedAt = new Date().toISOString()
            entity.updatedAt = entity.deletedAt
            await this.db.taskCheckItems.put(await taskCheckItemEntityToRecord(entity))
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(taskId: string): GoAsync<TaskCheckItemEntity[]> {
        try {
            const records = await this.db.taskCheckItems.where('taskId').equals(taskId).toArray()
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
                await this.db.taskCheckItems.put(await taskCheckItemEntityToRecord(current))
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