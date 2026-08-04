import { TagEntity } from '@nao-todo/domain-tag'
import { cryptoService } from '../crypto/crypto-service'
import type { TagRecord } from '../db/local-database'

/**
 * TagEntity → TagRecord
 * @description name/description 敏感字段加密存储
 */
export const tagEntityToRecord = async (entity: TagEntity): Promise<TagRecord> => ({
    id: entity.id,
    icon: entity.icon,
    name: await cryptoService.encrypt(entity.name),
    description: await cryptoService.encrypt(entity.description),
    color: entity.color,
    sortId: entity.sortId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * TagRecord → TagEntity（解密敏感字段）
 */
export const tagRecordToEntity = async (record: TagRecord): Promise<TagEntity> =>
    new TagEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.icon,
        await cryptoService.decrypt(record.name),
        await cryptoService.decrypt(record.description),
        record.color,
        record.sortId
    )