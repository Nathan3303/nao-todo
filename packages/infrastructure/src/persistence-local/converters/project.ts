import { ProjectEntity } from '@nao-todo/domain-project'
import { cryptoService } from '../crypto/crypto-service'
import type { ProjectRecord } from '../db/local-database'

/**
 * ProjectEntity → ProjectRecord
 * @description name/description 敏感字段加密存储，结构字段明文
 */
export const projectEntityToRecord = async (
    entity: ProjectEntity,
    userId: string
): Promise<ProjectRecord> => ({
    id: entity.id,
    userId,
    name: await cryptoService.encrypt(entity.name),
    icon: entity.icon,
    description:
        entity.description === null ? null : await cryptoService.encrypt(entity.description),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
    archivedAt: entity.archivedAt,
    deactivedAt: entity.deactivedAt,
    sortId: entity.sortId,
    // 领域统计属性（服务端 owned；本地不维护，仅快照透传）
    taskCount: entity.taskCount
})

/**
 * ProjectRecord → ProjectEntity（解密敏感字段）
 * @description 空串时间戳归一为 null：远程同步空字段以 "" 落库（与 tasks 的
 *              `taskRecordToEntity` 同口径）⇒ 读边界统一归一，避免下游 `=== null` 严格比较误判，
 *              并保证 push 载荷对「未归档」发**显式 `null`**（服务端三态清空）而非空串哨兵（T323/DEF-42）。
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
        record.archivedAt === '' ? null : record.archivedAt,
        record.deactivedAt,
        record.sortId,
        // 存量记录无计数字段（旧库）时兜底 0
        record.taskCount ?? 0
    )