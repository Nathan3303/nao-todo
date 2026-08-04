import {
    CreatePomodoroRecordValueObject,
    PomodoroRecordEntity,
    PomodoroRecordRepository
} from '@nao-todo/domain-pomodoro'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/shared'
import { pomodoroRecordEntityToItem, pomodoroRecordItemToEntity } from '../converters/pomodoro'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'

/**
 * 本地番茄钟记录仓储实现
 */
export class LocalPomodoroRecordRepoImpl implements PomodoroRecordRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    async get(id: string): GoAsync<PomodoroRecordEntity> {
        try {
            const record = await this.db.pomodoroRecords.get(id)
            if (!record) return [null, '专注记录不存在']
            return [await pomodoroRecordItemToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreatePomodoroRecordValueObject): GoAsync<PomodoroRecordEntity> {
        try {
            const now = new Date().toISOString()
            const entity = new PomodoroRecordEntity(
                crypto.randomUUID(),
                now,
                now,
                null,
                createVO.sessionId,
                createVO.pomodoroId,
                createVO.type,
                createVO.taskId,
                createVO.taskName,
                createVO.description,
                createVO.startAt,
                createVO.endAt,
                createVO.duration,
                createVO.note
            )
            await this.db.pomodoroRecords.add(await pomodoroRecordEntityToItem(entity))
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async list(
        queryString?: string
    ): GoAsync<{ entities: PomodoroRecordEntity[]; pagination?: ResponseDataPagination }> {
        try {
            const params = new URLSearchParams(queryString ?? '')
            let records = await this.db.pomodoroRecords.toArray()
            if (params.get('isDeleted') === 'true') {
                records = records.filter((r) => r.deletedAt !== null)
            } else if (params.get('isDeleted') === 'false') {
                records = records.filter((r) => r.deletedAt === null)
            }
            // 按开始时间倒序，与远程行为一致
            records.sort((a, b) => b.startAt.localeCompare(a.startAt))
            const entities: PomodoroRecordEntity[] = []
            for (const record of records) {
                entities.push(await pomodoroRecordItemToEntity(record))
            }
            return [{ entities }, null]
        } catch (err) {
            return [null, String(err)]
        }
    }
}

/**
 * 创建本地番茄钟记录仓储实例
 */
export const newLocalPomodoroRecordRepository = () => new LocalPomodoroRecordRepoImpl()