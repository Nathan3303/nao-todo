import { UserConfigEntity, UserEntity } from '@nao-todo/domain-identity'
import { cryptoService } from '../crypto/crypto-service'
import type { UserConfigRecord, UserRecord } from '../db/local-database'

/**
 * UserEntity → UserRecord
 * @description email/nickname/avatar 敏感字段加密存储
 */
export const userEntityToRecord = async (
    entity: UserEntity,
    userId: string
): Promise<UserRecord> => ({
    id: entity.id,
    userId,
    email: await cryptoService.encrypt(entity.email),
    nickname: await cryptoService.encrypt(entity.nickname),
    avatar: await cryptoService.encrypt(entity.avatar),
    createdFrom: entity.createdFrom,
    role: entity.role,
    state: entity.state,
    deactivedAt: entity.deactivedAt,
    lastRestoreAt: entity.lastRestoreAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * UserRecord → UserEntity（解密敏感字段）
 */
export const userRecordToEntity = async (record: UserRecord): Promise<UserEntity> =>
    new UserEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        await cryptoService.decrypt(record.email),
        await cryptoService.decrypt(record.nickname),
        await cryptoService.decrypt(record.avatar),
        record.createdFrom,
        record.role,
        record.state,
        record.deactivedAt,
        record.lastRestoreAt
    )

/**
 * UserConfigEntity → UserConfigRecord
 * @description appearance 为枚举值，明文存储
 */
export const userConfigEntityToRecord = (
    entity: UserConfigEntity,
    userId: string
): UserConfigRecord => ({
    id: entity.id,
    userId,
    appearance: entity.appearance,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt
})

/**
 * UserConfigRecord → UserConfigEntity
 */
export const userConfigRecordToEntity = (record: UserConfigRecord): UserConfigEntity =>
    new UserConfigEntity(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.appearance
    )