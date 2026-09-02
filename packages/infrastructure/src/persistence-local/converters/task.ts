import { TaskCheckItemEntity, TaskCommentEntity, TaskEntity } from '@nao-todo/domain-task'
import { cryptoService } from '../crypto/crypto-service'
import type { TaskCheckItemRecord, TaskCommentRecord, TaskRecord } from '../db/local-database'

/**
 * TaskEntity → TaskRecord
 * @description name/description 敏感字段加密存储，tags 为明文 string[]（外键）
 */
export const taskEntityToRecord = async (
    entity: TaskEntity,
    userId: string
): Promise<TaskRecord> => ({
    id: entity.id,
    userId,
    parentTaskId: entity.parentTaskId,
    name: await cryptoService.encrypt(entity.name),
    description: await cryptoService.encrypt(entity.description),
    state: entity.state,
    priority: entity.priority,
    startAt: entity.startAt,
    endAt: entity.endAt,
    projectId: entity.projectId,
    tags: [...entity.tags],
    archivedAt: entity.archivedAt,
    starMarkAt: entity.starMarkAt,
    givenUpAt: entity.givenUpAt,
    remindAt: entity.remindAt,
    remindRepeat: entity.remindRepeat,
    remindTime: entity.remindTime,
    remindWeekdays: [...entity.remindWeekdays],
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * TaskRecord → TaskEntity（解密敏感字段）
 * @description 空串时间戳归一为 null：远程同步空字段以 "" 落库（deletedAt/archivedAt/starMarkAt
 *              惯例一致），读边界统一归一避免下游 === null 严格比较误判。
 */
export const taskRecordToEntity = async (record: TaskRecord): Promise<TaskEntity> =>
    new TaskEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt === '' ? null : record.deletedAt,
        record.parentTaskId,
        await cryptoService.decrypt(record.name),
        await cryptoService.decrypt(record.description),
        record.state,
        record.priority,
        record.startAt,
        record.endAt,
        record.projectId,
        record.tags,
        record.archivedAt === '' ? null : record.archivedAt,
        record.starMarkAt === '' ? null : record.starMarkAt,
        record.givenUpAt,
        record.remindAt,
        record.remindRepeat,
        record.remindTime,
        record.remindWeekdays
    )

/**
 * TaskCheckItemEntity → TaskCheckItemRecord
 */
export const taskCheckItemEntityToRecord = async (
    entity: TaskCheckItemEntity,
    userId: string
): Promise<TaskCheckItemRecord> => ({
    id: entity.id,
    userId,
    taskId: entity.taskId,
    name: await cryptoService.encrypt(entity.name),
    isDone: entity.isDone,
    sortId: entity.sortId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * TaskCheckItemRecord → TaskCheckItemEntity（解密敏感字段）
 */
export const taskCheckItemRecordToEntity = async (
    record: TaskCheckItemRecord
): Promise<TaskCheckItemEntity> =>
    new TaskCheckItemEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.taskId,
        await cryptoService.decrypt(record.name),
        record.isDone,
        record.sortId
    )

/**
 * TaskCommentEntity → TaskCommentRecord
 * @description content/nickname/avatar 敏感字段加密存储，attachments 为明文 string[]
 */
export const taskCommentEntityToRecord = async (
    entity: TaskCommentEntity,
    userId: string
): Promise<TaskCommentRecord> => ({
    id: entity.id,
    userId,
    taskId: entity.taskId,
    content: await cryptoService.encrypt(entity.content),
    attachments: [...entity.attachments],
    isTopUp: entity.isTopUp,
    avatar: await cryptoService.encrypt(entity.avatar),
    nickname: await cryptoService.encrypt(entity.nickname),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * TaskCommentRecord → TaskCommentEntity（解密敏感字段）
 */
export const taskCommentRecordToEntity = async (
    record: TaskCommentRecord
): Promise<TaskCommentEntity> =>
    new TaskCommentEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.taskId,
        await cryptoService.decrypt(record.content),
        record.attachments,
        record.isTopUp,
        await cryptoService.decrypt(record.avatar),
        await cryptoService.decrypt(record.nickname)
    )