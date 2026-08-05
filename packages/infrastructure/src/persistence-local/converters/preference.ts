import { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import { TagPreferenceEntity } from '@nao-todo/domain-tag'
import { JsonStringValueObject } from '@nao-todo/shared'
import { cryptoService } from '../crypto/crypto-service'
import type { ProjectPreferenceRecord, TagPreferenceRecord } from '../db/local-database'

/**
 * ProjectPreferenceEntity → ProjectPreferenceRecord
 * @description JSON 配置字段加密存储，projectId 明文保索引
 */
export const projectPreferenceEntityToRecord = async (
    entity: ProjectPreferenceEntity,
    userId: string
): Promise<ProjectPreferenceRecord> => ({
    id: entity.id,
    userId,
    projectId: entity.projectId,
    viewType: entity.viewType,
    getTasksOptions: await cryptoService.encrypt(entity.getTasksOptions.unmarshal()),
    columns: await cryptoService.encrypt(entity.columns.unmarshal()),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * ProjectPreferenceRecord → ProjectPreferenceEntity（解密 JSON 字段）
 */
export const projectPreferenceRecordToEntity = async (
    record: ProjectPreferenceRecord
): Promise<ProjectPreferenceEntity> =>
    new ProjectPreferenceEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.projectId,
        record.viewType,
        JsonStringValueObject.CreateByJsonString(
            await cryptoService.decrypt(record.getTasksOptions)
        ),
        JsonStringValueObject.CreateByJsonString(await cryptoService.decrypt(record.columns))
    )

/**
 * TagPreferenceEntity → TagPreferenceRecord
 */
export const tagPreferenceEntityToRecord = async (
    entity: TagPreferenceEntity,
    userId: string
): Promise<TagPreferenceRecord> => ({
    id: entity.id,
    userId,
    tagId: entity.tagId,
    viewType: entity.viewType,
    getTasksOptions: await cryptoService.encrypt(entity.getTasksOptions.unmarshal()),
    columns: await cryptoService.encrypt(entity.columns.unmarshal()),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * TagPreferenceRecord → TagPreferenceEntity（解密 JSON 字段）
 */
export const tagPreferenceRecordToEntity = async (
    record: TagPreferenceRecord
): Promise<TagPreferenceEntity> =>
    new TagPreferenceEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.tagId,
        record.viewType,
        JsonStringValueObject.CreateByJsonString(
            await cryptoService.decrypt(record.getTasksOptions)
        ),
        JsonStringValueObject.CreateByJsonString(await cryptoService.decrypt(record.columns))
    )