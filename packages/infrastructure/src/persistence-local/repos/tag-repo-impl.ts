import { TagEntity, TagRepository } from '@nao-todo/domain-tag'
import type { GoAsync } from '@nao-todo/shared'
import { tagEntityToRecord, tagRecordToEntity } from '../converters/tag'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'

/**
 * 本地标签仓储实现
 * @description 基于 IndexedDB（dexie），name/description 加密存储
 */
export class LocalTagRepoImpl implements TagRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    async getById(id: string): GoAsync<TagEntity> {
        try {
            const record = await this.db.tags.get(id)
            if (!record) return [null, '标签不存在']
            return [await tagRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createdEntity: TagEntity): GoAsync<TagEntity> {
        try {
            await this.db.tags.add(await tagEntityToRecord(createdEntity))
            return [createdEntity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(updatedEntity: TagEntity): GoAsync<void> {
        try {
            updatedEntity.updatedAt = new Date().toISOString()
            await this.db.tags.put(await tagEntityToRecord(updatedEntity))
            return null
        } catch (err) {
            return String(err)
        }
    }

    async deleteById(id: string): GoAsync<void> {
        try {
            const record = await this.db.tags.get(id)
            if (!record) return '标签不存在'
            const entity = await tagRecordToEntity(record)
            entity.deletedAt = new Date().toISOString()
            entity.updatedAt = entity.deletedAt
            await this.db.tags.put(await tagEntityToRecord(entity))
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(): GoAsync<TagEntity[]> {
        try {
            const records = await this.db.tags.toArray()
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
                await this.db.tags.put(await tagEntityToRecord(entity))
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