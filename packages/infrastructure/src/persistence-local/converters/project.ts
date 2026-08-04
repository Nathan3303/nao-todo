import { ProjectEntity } from '@nao-todo/domain-project'
import { cryptoService } from '../crypto/crypto-service'
import type { ProjectRecord } from '../db/local-database'

/**
 * ProjectEntity → ProjectRecord
 * @description name/description 敏感字段加密存储，结构字段明文
 */
export const projectEntityToRecord = async (entity: ProjectEntity): Promise<ProjectRecord> => ({
    id: entity.id,
    name: await cryptoService.encrypt(entity.name),
    icon: entity.icon,
    description:
        entity.description === null ? null : await cryptoService.encrypt(entity.description),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
    archivedAt: entity.archivedAt,
    deactivedAt: entity.deactivedAt,
    sortId: entity.sortId
})

/**
 * ProjectRecord → ProjectEntity（解密敏感字段）
 */
export const projectRecordToEntity = async (record: ProjectRecord): Promise<ProjectEntity> =>
    new ProjectEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        await cryptoService.decrypt(record.name),
        record.icon,
        record.description === null ? null : await cryptoService.decrypt(record.description),
        record.archivedAt,
        record.deactivedAt,
        record.sortId
    )