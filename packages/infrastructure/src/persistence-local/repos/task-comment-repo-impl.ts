import {
    CreateTaskCommentValueObject,
    TaskCommentEntity,
    TaskCommentRepository,
    UpdateTaskCommentValueObject
} from '@nao-todo/domain-task'
import type { GoAsync } from '@nao-todo/shared'
import { taskCommentEntityToRecord, taskCommentRecordToEntity } from '../converters/task'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'

/**
 * 本地任务评论仓储实现
 * @description 本地场景无用户体系，avatar/nickname 置空
 */
export class LocalTaskCommentRepoImpl implements TaskCommentRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async get(id: string): GoAsync<TaskCommentEntity> {
        try {
            const record = await this.db.taskComments.get(id)
            if (!record || record.userId !== this.currentUserId) return [null, '评论不存在']
            return [await taskCommentRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreateTaskCommentValueObject): GoAsync<TaskCommentEntity> {
        try {
            const now = new Date().toISOString()
            const entity = new TaskCommentEntity(
                crypto.randomUUID(),
                now,
                now,
                null,
                createVO.taskId,
                createVO.content,
                createVO.attachments ?? [],
                createVO.isTopUp,
                '',
                ''
            )
            await this.db.taskComments.add(
                await taskCommentEntityToRecord(entity, this.currentUserId)
            )
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(updateVO: UpdateTaskCommentValueObject): GoAsync<void> {
        try {
            const record = await this.db.taskComments.get(updateVO.id)
            if (!record || record.userId !== this.currentUserId) return '评论不存在'
            const entity = await taskCommentRecordToEntity(record)
            if (updateVO.content !== undefined) entity.content = updateVO.content
            if (updateVO.isTopUp !== undefined) entity.isTopUp = updateVO.isTopUp
            entity.updatedAt = new Date().toISOString()
            await this.db.taskComments.put(
                await taskCommentEntityToRecord(entity, this.currentUserId)
            )
            return null
        } catch (err) {
            return String(err)
        }
    }

    async delete(id: string): GoAsync<void> {
        try {
            const record = await this.db.taskComments.get(id)
            if (!record || record.userId !== this.currentUserId) return '评论不存在'
            const entity = await taskCommentRecordToEntity(record)
            entity.deletedAt = new Date().toISOString()
            entity.updatedAt = entity.deletedAt
            await this.db.taskComments.put(
                await taskCommentEntityToRecord(entity, this.currentUserId)
            )
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(taskId: string): GoAsync<TaskCommentEntity[]> {
        try {
            const records = await this.db.taskComments
                .where('taskId')
                .equals(taskId)
                .filter((r) => r.userId === this.currentUserId)
                .toArray()
            const entities: TaskCommentEntity[] = []
            for (const record of records) {
                entities.push(await taskCommentRecordToEntity(record))
            }
            entities.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            return [entities, null]
        } catch (err) {
            return [null, String(err)]
        }
    }
}

/**
 * 创建本地任务评论仓储实例
 */
export const newLocalTaskCommentRepository = () => new LocalTaskCommentRepoImpl()