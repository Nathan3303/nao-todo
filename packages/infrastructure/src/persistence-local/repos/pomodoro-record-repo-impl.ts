import {
    CreatePomodoroRecordValueObject,
    PomodoroRecordEntity,
    PomodoroRecordRepository
} from '@nao-todo/domain-pomodoro'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/shared'
import { pomodoroRecordEntityToItem, pomodoroRecordItemToEntity } from '../converters/pomodoro'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { snowflake } from '../../persistence-sync/snowflake'
import { syncTracker } from '../../persistence-sync/sync-tracker'

/**
 * 本地番茄钟记录仓储实现
 */
export class LocalPomodoroRecordRepoImpl implements PomodoroRecordRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async get(id: string): GoAsync<PomodoroRecordEntity> {
        try {
            const record = await this.db.pomodoroRecords.get(id)
            if (!record || record.userId !== this.currentUserId) return [null, '专注记录不存在']
            return [await pomodoroRecordItemToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreatePomodoroRecordValueObject): GoAsync<PomodoroRecordEntity> {
        try {
            const now = new Date().toISOString()
            const entity = new PomodoroRecordEntity(
                snowflake.nextId(),
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
            // 异步加密在事务外完成（WebCrypto await 会中断 Dexie 事务）
            const record = await pomodoroRecordEntityToItem(entity, this.currentUserId)
            await this.db.transaction(
                'rw',
                this.db.pomodoroRecords,
                this.db.pomodoros,
                async () => {
                    await this.db.pomodoroRecords.add(record)
                    // 完成专注时累加对应常用专注的累计时长（与远程后端行为一致）；
                    // pomodoroId 为空或常用专注不存在/不属于当前用户则跳过。
                    // 注意：totalDuration 有意不 markDirty —— 同步策略"信任远程 totalDuration 字段"（
                    // 后端原子维护，见 sync-service.recalculateTotalDurations 注释），拉取时远程值会覆盖本地，勿在此登记脏队列
                    if (record.pomodoroId) {
                        const pomodoro = await this.db.pomodoros.get(record.pomodoroId)
                        if (pomodoro && pomodoro.userId === this.currentUserId) {
                            pomodoro.totalDuration += record.duration
                            await this.db.pomodoros.put(pomodoro)
                        }
                    }
                }
            )
            await syncTracker.markDirty('pomodoroRecords', entity.id, 'upsert', entity.updatedAt)
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
            let records = await this.db.pomodoroRecords
                .where('userId')
                .equals(this.currentUserId)
                .toArray()
            if (params.get('isDeleted') === 'true') {
                records = records.filter((r) => r.deletedAt !== null)
            } else if (params.get('isDeleted') === 'false') {
                records = records.filter((r) => r.deletedAt === null)
            }
            // 常用专注详情：按 pomodoroId 过滤（未传则不过滤，兼容其他调用）
            const pomodoroId = params.get('pomodoroId')
            if (pomodoroId) {
                records = records.filter((r) => r.pomodoroId === pomodoroId)
            }
            // 按开始时间倒序，与远程行为一致
            records.sort((a, b) => b.startAt.localeCompare(a.startAt))
            // 分页（page/limit，limit 默认 20）
            const page = Math.max(parseInt(params.get('page') ?? '1', 10) || 1, 1)
            const limit = Math.max(parseInt(params.get('limit') ?? '20', 10) || 20, 1)
            const total = records.length
            const maxPage = Math.max(Math.ceil(total / limit), 1)
            const start = (page - 1) * limit
            const pageRecords = records.slice(start, start + limit)
            const entities: PomodoroRecordEntity[] = []
            for (const record of pageRecords) {
                entities.push(await pomodoroRecordItemToEntity(record))
            }
            return [{ entities, pagination: { total, page, limit, maxPage } }, null]
        } catch (err) {
            return [null, String(err)]
        }
    }
}

/**
 * 创建本地番茄钟记录仓储实例
 */
export const newLocalPomodoroRecordRepository = () => new LocalPomodoroRecordRepoImpl()