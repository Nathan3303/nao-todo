import {
    CreateProjectValueObject,
    ProjectEntity,
    ProjectRepository,
    UpdateProjectValueObject
} from '@nao-todo/domain-project'
import type { GoAsync } from '@nao-todo/shared'
import { projectEntityToRecord, projectRecordToEntity } from '../converters/project'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { snowflake } from '../../persistence-sync/snowflake'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { localSession } from '../session/local-session'

/**
 * 本地项目仓储实现
 * @description 基于 IndexedDB（dexie），name/description 加密存储
 */
export class LocalProjectRepoImpl implements ProjectRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async get(id: string): GoAsync<ProjectEntity> {
        try {
            const record = await this.db.projects.get(id)
            if (!record || record.userId !== this.currentUserId) return [null, '项目不存在']
            return [await projectRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreateProjectValueObject): GoAsync<ProjectEntity> {
        try {
            const now = new Date().toISOString()
            const entity = new ProjectEntity(
                snowflake.nextId(),
                now,
                now,
                null,
                createVO.name,
                createVO.icon,
                createVO.description,
                null,
                null,
                0
            )
            await this.db.projects.add(await projectEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('projects', entity.id, 'upsert', entity.updatedAt)
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(updateVO: UpdateProjectValueObject): GoAsync<void> {
        try {
            const record = await this.db.projects.get(updateVO.id)
            if (!record || record.userId !== this.currentUserId) return '项目不存在'
            const entity = await projectRecordToEntity(record)
            if (updateVO.name !== undefined) entity.name = updateVO.name
            if (updateVO.icon !== undefined) entity.icon = updateVO.icon
            if (updateVO.description !== undefined) entity.description = updateVO.description
            if (updateVO.sortId !== undefined) entity.sortId = updateVO.sortId
            entity.updatedAt = new Date().toISOString()
            await this.db.projects.put(await projectEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('projects', updateVO.id, 'upsert', entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async delete(id: string): GoAsync<void> {
        try {
            const record = await this.db.projects.get(id)
            if (!record || record.userId !== this.currentUserId) return '项目不存在'
            const entity = await projectRecordToEntity(record)
            entity.deletedAt = new Date().toISOString()
            entity.updatedAt = entity.deletedAt
            await this.db.projects.put(await projectEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty(
                'projects',
                id,
                'delete',
                entity.deletedAt ?? entity.updatedAt
            )
            return null
        } catch (err) {
            return String(err)
        }
    }

    async restore(id: string): GoAsync<void> {
        try {
            const record = await this.db.projects.get(id)
            if (!record || record.userId !== this.currentUserId) return '项目不存在'
            const entity = await projectRecordToEntity(record)
            entity.deletedAt = null
            entity.updatedAt = new Date().toISOString()
            await this.db.projects.put(await projectEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('projects', id, 'upsert', entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async archive(id: string): GoAsync<void> {
        try {
            const record = await this.db.projects.get(id)
            if (!record || record.userId !== this.currentUserId) return '项目不存在'
            const entity = await projectRecordToEntity(record)
            entity.archivedAt = new Date().toISOString()
            entity.updatedAt = entity.archivedAt
            await this.db.projects.put(await projectEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('projects', id, 'upsert', entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async unarchive(id: string): GoAsync<void> {
        try {
            const record = await this.db.projects.get(id)
            if (!record || record.userId !== this.currentUserId) return '项目不存在'
            const entity = await projectRecordToEntity(record)
            entity.archivedAt = null
            entity.updatedAt = new Date().toISOString()
            await this.db.projects.put(await projectEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('projects', id, 'upsert', entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(): GoAsync<ProjectEntity[]> {
        try {
            const records = await this.db.projects
                .where('userId')
                .equals(this.currentUserId)
                .toArray()
            const entities: ProjectEntity[] = []
            for (const record of records) {
                entities.push(await projectRecordToEntity(record))
            }
            return [entities, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async batchUpdate(updateVOs: UpdateProjectValueObject[]): GoAsync<ProjectEntity[]> {
        try {
            const entities: ProjectEntity[] = []
            for (const updateVO of updateVOs) {
                const [entity, err] = await this.get(updateVO.id)
                if (err !== null) continue
                const current = entity as ProjectEntity
                if (updateVO.name !== undefined) current.name = updateVO.name
                if (updateVO.icon !== undefined) current.icon = updateVO.icon
                if (updateVO.description !== undefined) current.description = updateVO.description
                if (updateVO.sortId !== undefined) current.sortId = updateVO.sortId
                current.updatedAt = new Date().toISOString()
                await this.db.projects.put(await projectEntityToRecord(current, this.currentUserId))
                await syncTracker.markDirty('projects', current.id, 'upsert', current.updatedAt)
                entities.push(current)
            }
            return [entities, null]
        } catch (err) {
            return [null, String(err)]
        }
    }
}

/**
 * 创建本地项目仓储实例
 */
export const newLocalProjectRepository = () => new LocalProjectRepoImpl()