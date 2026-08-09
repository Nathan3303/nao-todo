import {
    CreatePomodoroValueObject,
    PomodoroEntity,
    PomodoroRepository,
    UpdatePomodoroValueObject
} from '@nao-todo/domain-pomodoro'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/shared'
import { pomodoroEntityToRecord, pomodoroRecordToEntity } from '../converters/pomodoro'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { snowflake } from '../../persistence-sync/snowflake'
import { syncTracker } from '../../persistence-sync/sync-tracker'

/**
 * 本地番茄钟仓储实现
 */
export class LocalPomodoroRepoImpl implements PomodoroRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async get(id: string): GoAsync<PomodoroEntity> {
        try {
            const record = await this.db.pomodoros.get(id)
            if (!record || record.userId !== this.currentUserId) return [null, '番茄钟不存在']
            return [await pomodoroRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreatePomodoroValueObject): GoAsync<PomodoroEntity> {
        try {
            const now = new Date().toISOString()
            const entity = new PomodoroEntity(
                snowflake.nextId(),
                now,
                now,
                null,
                createVO.type,
                createVO.name,
                createVO.description,
                createVO.duration,
                null,
                createVO.duration
            )
            await this.db.pomodoros.add(await pomodoroEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('pomodoros', entity.id, 'upsert', entity.updatedAt)
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(updateVO: UpdatePomodoroValueObject): GoAsync<void> {
        try {
            const record = await this.db.pomodoros.get(updateVO.id)
            if (!record || record.userId !== this.currentUserId) return '番茄钟不存在'
            const entity = await pomodoroRecordToEntity(record)
            if (updateVO.type !== undefined) entity.type = updateVO.type
            if (updateVO.name !== undefined) entity.name = updateVO.name
            if (updateVO.description !== undefined) entity.description = updateVO.description
            if (updateVO.duration !== undefined) entity.duration = updateVO.duration
            entity.updatedAt = new Date().toISOString()
            await this.db.pomodoros.put(await pomodoroEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('pomodoros', updateVO.id, 'upsert', entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async delete(id: string): GoAsync<void> {
        try {
            const record = await this.db.pomodoros.get(id)
            if (!record || record.userId !== this.currentUserId) return '番茄钟不存在'
            const entity = await pomodoroRecordToEntity(record)
            entity.deletedAt = new Date().toISOString()
            entity.updatedAt = entity.deletedAt
            await this.db.pomodoros.put(await pomodoroEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty(
                'pomodoros',
                id,
                'delete',
                entity.deletedAt ?? entity.updatedAt
            )
            return null
        } catch (err) {
            return String(err)
        }
    }

    async archived(id: string): GoAsync<void> {
        try {
            const record = await this.db.pomodoros.get(id)
            if (!record || record.userId !== this.currentUserId) return '番茄钟不存在'
            const entity = await pomodoroRecordToEntity(record)
            entity.archivedAt = new Date().toISOString()
            entity.updatedAt = entity.archivedAt
            await this.db.pomodoros.put(await pomodoroEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('pomodoros', id, 'upsert', entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async unarchived(id: string): GoAsync<void> {
        try {
            const record = await this.db.pomodoros.get(id)
            if (!record || record.userId !== this.currentUserId) return '番茄钟不存在'
            const entity = await pomodoroRecordToEntity(record)
            entity.archivedAt = null
            entity.updatedAt = new Date().toISOString()
            await this.db.pomodoros.put(await pomodoroEntityToRecord(entity, this.currentUserId))
            await syncTracker.markDirty('pomodoros', id, 'upsert', entity.updatedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(
        queryString?: string
    ): GoAsync<{ pomodoroEntities: PomodoroEntity[]; pagination?: ResponseDataPagination }> {
        try {
            const params = new URLSearchParams(queryString ?? '')
            let records = await this.db.pomodoros
                .where('userId')
                .equals(this.currentUserId)
                .toArray()
            if (params.get('isDeleted') === 'true') {
                records = records.filter((r) => r.deletedAt !== null)
            } else if (params.get('isDeleted') === 'false') {
                records = records.filter((r) => r.deletedAt === null)
            }
            if (params.get('isArchived') === 'true') {
                records = records.filter((r) => r.archivedAt !== null)
            } else if (params.get('isArchived') === 'false') {
                records = records.filter((r) => r.archivedAt === null)
            }
            const entities: PomodoroEntity[] = []
            for (const record of records) {
                entities.push(await pomodoroRecordToEntity(record))
            }
            return [{ pomodoroEntities: entities }, null]
        } catch (err) {
            return [null, String(err)]
        }
    }
}

/**
 * 创建本地番茄钟仓储实例
 */
export const newLocalPomodoroRepository = () => new LocalPomodoroRepoImpl()