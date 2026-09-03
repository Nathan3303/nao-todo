import { PomodoroEntity, PomodoroRecordEntity } from '@nao-todo/domain-pomodoro'
import { cryptoService } from '../crypto/crypto-service'
import type { PomodoroRecordItem, PomodoroRecord } from '../db/local-database'

/**
 * PomodoroEntity → PomodoroRecord
 * @description name/description 敏感字段加密存储
 */
export const pomodoroEntityToRecord = async (
    entity: PomodoroEntity,
    userId: string
): Promise<PomodoroRecord> => ({
    id: entity.id,
    userId,
    type: entity.type,
    name: await cryptoService.encrypt(entity.name),
    description:
        entity.description === null ? null : await cryptoService.encrypt(entity.description),
    duration: entity.duration,
    archivedAt: entity.archivedAt,
    totalDuration: entity.totalDuration,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * PomodoroRecord → PomodoroEntity（解密敏感字段）
 * @description 空串时间戳归一为 null（远程同步空字段 "" 惯例，见 taskRecordToEntity 同款处理）
 */
export const pomodoroRecordToEntity = async (record: PomodoroRecord): Promise<PomodoroEntity> =>
    new PomodoroEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt === '' ? null : record.deletedAt,
        record.type,
        await cryptoService.decrypt(record.name),
        record.description === null ? null : await cryptoService.decrypt(record.description),
        record.duration,
        record.archivedAt === '' ? null : record.archivedAt,
        record.totalDuration
    )

/**
 * PomodoroRecordEntity → PomodoroRecordItem
 * @description taskName/description/note 敏感字段加密存储
 */
export const pomodoroRecordEntityToItem = async (
    entity: PomodoroRecordEntity,
    userId: string
): Promise<PomodoroRecordItem> => ({
    id: entity.id,
    userId,
    sessionId: entity.sessionId,
    pomodoroId: entity.pomodoroId,
    type: entity.type,
    taskId: entity.taskId,
    taskName: await cryptoService.encrypt(entity.taskName),
    description: await cryptoService.encrypt(entity.description),
    startAt: entity.startAt,
    endAt: entity.endAt,
    duration: entity.duration,
    note: entity.note === null ? null : await cryptoService.encrypt(entity.note),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * PomodoroRecordItem → PomodoroRecordEntity（解密敏感字段）
 */
export const pomodoroRecordItemToEntity = async (
    record: PomodoroRecordItem
): Promise<PomodoroRecordEntity> =>
    new PomodoroRecordEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.sessionId,
        record.pomodoroId,
        record.type,
        record.taskId,
        await cryptoService.decrypt(record.taskName),
        await cryptoService.decrypt(record.description),
        record.startAt,
        record.endAt,
        record.duration,
        record.note === null ? null : await cryptoService.decrypt(record.note)
    )