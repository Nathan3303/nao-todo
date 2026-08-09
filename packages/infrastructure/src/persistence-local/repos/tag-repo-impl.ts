import { TagEntity, TagRepository } from '@nao-todo/domain-tag'
import type { GoAsync } from '@nao-todo/shared'
import { tagEntityToRecord, tagRecordToEntity } from '../converters/tag'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { snowflake } from '../../persistence-sync/snowflake'
import { syncTracker } from '../../persistence-sync/sync-tracker'

/**
 * 本地标签仓储实现
 * @description 基于 IndexedDB（dexie），name/description 加密存储
 */
export class LocalTagRepoImpl implements TagRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async getById(id: string): GoAsync<TagEntity> {
        try {
            const record = await this.db.tags.get(id)
            if (!record || record.userId !== this.currentUserId) return [null, '标签不存在']
            return [await tagRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createdEntity: TagEntity): GoAsync<TagEntity> {
        try {
            // 远程模式 id 由后端生成；本地必须自生成唯一 id，
            // 否则传入实体 id 为空串（_createWithEmpty），多次 add 主键冲突导致创建失败
            const entity = new TagEntity(
                snowflake.nextId(),
                createdEntity.createdAt,
                createdEntity.updatedAt,
                createdEntity.deletedAt,
                createdEntity.icon,
                createdEntity.name,
                createdEntity.description,
                createdEntity.color,
                createdEntity.sortId
            )
            await this.db.tags.add(await tagEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('tags', entity.id, 'upsert', entity.updatedAt)
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(updatedEntity: TagEntity): GoAsync<void> {
        try {
            updatedEntity.updatedAt = new Date().toISOString()
            await this.db.tags.put(await tagEntityToRecord(updatedEntity, this.currentUserId))
            await syncTracker.markDirty('tags', updatedEntity.id, 'upsert', updatedEntity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async deleteById(id: string): GoAsync<void> {
        try {
            const record = await this.db.tags.get(id)
            if (!record || record.userId !== this.currentUserId) return '标签不存在'
            const entity = await tagRecordToEntity(record)
            entity.deletedAt = new Date().toISOString()
            entity.updatedAt = entity.deletedAt
            await this.db.tags.put(await tagEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('tags', id, 'delete', entity.deletedAt ?? entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(): GoAsync<TagEntity[]> {
        try {
            const records = await this.db.tags.where('userId').equals(this.currentUserId).toArray()
            const entities: TagEntity[] = []
            for (const record of records) {
                entities.push(await tagRecordToEntity(record))
            }
            return [entities, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async getByIds(ids: string[]): GoAsync<TagEntity[]> {
        try {
            const entities: TagEntity[] = []
            for (const id of ids) {
                const [entity, err] = await this.getById(id)
                if (err === null && entity !== null) entities.push(entity)
            }
            return [entities, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async batchUpdate(updatedEntities: TagEntity[]): GoAsync<TagEntity[]> {
        try {
            const entities: TagEntity[] = []
            for (const entity of updatedEntities) {
                entity.updatedAt = new Date().toISOString()
                await this.db.tags.put(await tagEntityToRecord(entity, this.currentUserId))
                await syncTracker.markDirty('tags', entity.id, 'upsert', entity.updatedAt)
                entities.push(entity)
            }
            return [entities, null]
        } catch (err) {
            return [null, String(err)]
        }
    }
}

/**
 * 创建本地标签仓储实例
 */
export const newLocalTagRepository = () => new LocalTagRepoImpl()