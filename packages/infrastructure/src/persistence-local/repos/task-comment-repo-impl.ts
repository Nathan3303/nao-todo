import {
    CreateTaskCommentValueObject,
    TaskCommentEntity,
    TaskCommentRepository,
    UpdateTaskCommentValueObject
} from '@nao-todo/domain-task'
import type { GoAsync } from '@nao-todo/shared'
import { taskCommentEntityToRecord, taskCommentRecordToEntity } from '../converters/task'
import { isNotDeleted } from '../utils'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { putWithSyncBaseAndEnqueue } from './put-with-sync-base'
import { localSession } from '../session/local-session'
import { snowflake } from '../../persistence-sync/snowflake'
import { nowCalibratedIso } from '../../persistence-sync/sync-config'

/**
 * 本地任务评论仓储实现
 * @description 本地优先下评论立即可见；作者昵称/头像由展示层随创建入参补齐
 *              （服务端拉取后以其为准）。
 */
export class LocalTaskCommentRepoImpl implements TaskCommentRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.requireCurrentUserId()
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
            const now = nowCalibratedIso()
            const entity = new TaskCommentEntity(
                snowflake.nextId(),
                now,
                now,
                null,
                createVO.taskId,
                createVO.content,
                createVO.attachments ?? [],
                createVO.isTopUp,
                createVO.avatar,
                createVO.nickname
            )
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.taskComments,
                'taskComments',
                await taskCommentEntityToRecord(entity, this.currentUserId),
                'upsert',
                entity.updatedAt
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
            entity.updatedAt = nowCalibratedIso()
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.taskComments,
                'taskComments',
                await taskCommentEntityToRecord(entity, this.currentUserId),
                'upsert',
                entity.updatedAt
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
            entity.deletedAt = nowCalibratedIso()
            entity.updatedAt = entity.deletedAt
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.taskComments,
                'taskComments',
                await taskCommentEntityToRecord(entity, this.currentUserId),
                'delete',
                entity.deletedAt ?? entity.updatedAt
            )
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(taskId: string): GoAsync<TaskCommentEntity[]> {
        try {
            // C-55：先硬失败取数（空会话 ⇒ 不进入库读，避免“无记录 ⇒ 返回 []”的成功路径）
            const userId = this.currentUserId
            const records = await this.db.taskComments
                .where('taskId')
                .equals(taskId)
                .filter((r) => r.userId === userId && isNotDeleted(r.deletedAt))
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