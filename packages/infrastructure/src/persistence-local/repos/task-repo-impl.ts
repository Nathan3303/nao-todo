import {
    CreateTaskValueObject,
    TaskEntity,
    TaskRepository,
    UpdateTaskValueObject
} from '@nao-todo/domain-task'
import type { GoAsync, ResponseDataPagination } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { taskEntityToRecord, taskRecordToEntity } from '../converters/task'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'

/**
 * 解析 list 查询串
 * @param queryString "key=value&..." 格式（来自 QueryOptionsValueObject.toString()）
 */
const parseListQuery = (queryString?: string): Record<string, string> => {
    if (!queryString) return {}
    const params = new URLSearchParams(queryString)
    const result: Record<string, string> = {}
    params.forEach((value, key) => {
        result[key] = value
    })
    return result
}

/**
 * 相对日期匹配（按任务 endAt 判定）
 */
const matchRelativeDate = (endAt: string, relativeDate: string): boolean => {
    const d = dayjs(endAt)
    if (!d.isValid()) return false
    const now = dayjs()
    switch (relativeDate) {
        case 'today':
            return d.isSame(now, 'day')
        case 'tomorrow':
            return d.isSame(now.add(1, 'day'), 'day')
        case 'week':
            return d.isSame(now, 'week')
        case 'month':
            return d.isSame(now, 'month')
        case '-today':
            return d.isBefore(now.startOf('day'))
        case '-overdue':
            return d.isBefore(now)
        default:
            return true
    }
}

/**
 * 本地任务仓储实现
 * @description 基于 IndexedDB（dexie）。结构字段明文保索引，name/description 加密后
 *              仅能在解密阶段做内容过滤（本地数据量小，可接受）。
 */
export class LocalTaskRepoImpl implements TaskRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    async get(id: string): GoAsync<TaskEntity> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record) return [null, '任务不存在']
            return [await taskRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreateTaskValueObject): GoAsync<TaskEntity> {
        try {
            const now = new Date().toISOString()
            const entity = new TaskEntity(
                crypto.randomUUID(),
                now,
                now,
                null,
                createVO.parentTaskId ?? '',
                createVO.name,
                createVO.description,
                createVO.state,
                createVO.priority,
                createVO.startAt ?? '',
                createVO.endAt ?? '',
                createVO.projectId,
                createVO.tags ?? [],
                null,
                null,
                null,
                createVO.remindAt ?? '',
                createVO.remindRepeat,
                createVO.remindTime ?? '',
                createVO.remindWeekdays ?? []
            )
            await this.db.tasks.add(await taskEntityToRecord(entity))
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(id: string, updateVO: UpdateTaskValueObject): GoAsync<void> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record) return '任务不存在'
            const entity = await taskRecordToEntity(record)
            if (updateVO.parentTaskId !== undefined) entity.parentTaskId = updateVO.parentTaskId
            if (updateVO.name !== undefined) entity.name = updateVO.name
            if (updateVO.description !== undefined) entity.description = updateVO.description
            if (updateVO.state !== undefined) entity.state = updateVO.state
            if (updateVO.priority !== undefined) entity.priority = updateVO.priority
            if (updateVO.startAt !== undefined) entity.startAt = updateVO.startAt ?? ''
            if (updateVO.endAt !== undefined) entity.endAt = updateVO.endAt ?? ''
            if (updateVO.projectId !== undefined) entity.projectId = updateVO.projectId
            if (updateVO.tags !== undefined) entity.tags = updateVO.tags
            if (updateVO.givenUpAt !== undefined) entity.givenUpAt = updateVO.givenUpAt
            if (updateVO.remindAt !== undefined) entity.remindAt = updateVO.remindAt ?? ''
            if (updateVO.remindRepeat !== undefined) entity.remindRepeat = updateVO.remindRepeat
            if (updateVO.remindTime !== undefined) entity.remindTime = updateVO.remindTime ?? ''
            if (updateVO.remindWeekdays !== undefined)
                entity.remindWeekdays = updateVO.remindWeekdays
            entity.updatedAt = new Date().toISOString()
            await this.db.tasks.put(await taskEntityToRecord(entity))
            return null
        } catch (err) {
            return String(err)
        }
    }

    async remove(id: string): GoAsync<void> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record) return '任务不存在'
            const entity = await taskRecordToEntity(record)
            entity.deletedAt = new Date().toISOString()
            entity.updatedAt = entity.deletedAt
            await this.db.tasks.put(await taskEntityToRecord(entity))
            return null
        } catch (err) {
            return String(err)
        }
    }

    async restore(id: string): GoAsync<void> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record) return '任务不存在'
            const entity = await taskRecordToEntity(record)
            entity.deletedAt = null
            entity.updatedAt = new Date().toISOString()
            await this.db.tasks.put(await taskEntityToRecord(entity))
            return null
        } catch (err) {
            return String(err)
        }
    }

    async list(
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> {
        try {
            const query = parseListQuery(queryString)
            // 1. 结构字段过滤（明文，走索引语义）
            let records = await this.db.tasks.toArray()
            if (query.isDeleted === 'true') {
                records = records.filter((r) => r.deletedAt !== null)
            } else if (query.isDeleted === 'false') {
                records = records.filter((r) => r.deletedAt === null)
            }
            if (query.isArchived === 'true') {
                records = records.filter((r) => r.archivedAt !== null)
            } else if (query.isArchived === 'false') {
                records = records.filter((r) => r.archivedAt === null)
            }
            if (query.isStarMarked === 'true') {
                records = records.filter((r) => r.starMarkAt !== null)
            } else if (query.isStarMarked === 'false') {
                records = records.filter((r) => r.starMarkAt === null)
            }
            if (query.isGivenUp === 'true') {
                records = records.filter((r) => dayjs(r.givenUpAt).isValid())
            } else if (query.isGivenUp === 'false') {
                records = records.filter((r) => !dayjs(r.givenUpAt).isValid())
            }
            if (query.state) records = records.filter((r) => r.state === query.state)
            if (query.priority) records = records.filter((r) => r.priority === query.priority)
            if (query.projectId) records = records.filter((r) => r.projectId === query.projectId)
            if (query.parentTaskId) {
                records = records.filter((r) => r.parentTaskId === query.parentTaskId)
            }
            const tagId = query.tagId
            if (tagId !== undefined) records = records.filter((r) => r.tags.includes(tagId))
            const relativeDate = query.relativeDate
            if (relativeDate !== undefined) {
                records = records.filter((r) => matchRelativeDate(r.endAt, relativeDate))
            }
            // 2. 解密
            const entities: TaskEntity[] = []
            for (const record of records) {
                entities.push(await taskRecordToEntity(record))
            }
            // 3. 内容字段过滤（需解密后）
            let result = entities
            const nameFilter = query.name
            if (nameFilter !== undefined) {
                result = result.filter((e) => e.name.includes(nameFilter))
            }
            const descriptionFilter = query.description
            if (descriptionFilter !== undefined) {
                result = result.filter((e) => e.description.includes(descriptionFilter))
            }
            // 4. 排序
            if (query.sort) {
                try {
                    const sort = JSON.parse(query.sort) as { field: string; order: string }
                    const dir = sort.order === 'desc' ? -1 : 1
                    result.sort((a, b) => {
                        const av = (a as unknown as Record<string, unknown>)[sort.field]
                        const bv = (b as unknown as Record<string, unknown>)[sort.field]
                        if (av === bv) return 0
                        if (av === null || av === undefined) return 1
                        if (bv === null || bv === undefined) return -1
                        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
                        return (
                            String(av as string | number | boolean).localeCompare(
                                String(bv as string | number | boolean)
                            ) * dir
                        )
                    })
                } catch {
                    // sort JSON 解析失败时忽略排序
                }
            }
            // 5. 分页
            const page = Math.max(1, Number(query.page) || 1)
            const limit = Math.max(1, Number(query.limit) || 20)
            const total = result.length
            const maxPage = Math.max(1, Math.ceil(total / limit))
            const paged = result.slice((page - 1) * limit, page * limit)
            return [{ taskEntities: paged, pagination: { total, page, limit, maxPage } }, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async copy(id: string): GoAsync<TaskEntity> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record) return [null, '任务不存在']
            const entity = await taskRecordToEntity(record)
            const now = new Date().toISOString()
            const copyEntity = new TaskEntity(
                crypto.randomUUID(),
                now,
                now,
                null,
                entity.parentTaskId,
                entity.name,
                entity.description,
                entity.state,
                entity.priority,
                entity.startAt,
                entity.endAt,
                entity.projectId,
                entity.tags,
                null,
                null,
                null,
                entity.remindAt,
                entity.remindRepeat,
                entity.remindTime,
                entity.remindWeekdays
            )
            await this.db.tasks.add(await taskEntityToRecord(copyEntity))
            return [copyEntity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async snooze(id: string, durationMinutes: number): GoAsync<string> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record) return [null, '任务不存在']
            const entity = await taskRecordToEntity(record)
            const newRemindAt = dayjs().add(durationMinutes, 'minute').toISOString()
            entity.remindAt = newRemindAt
            entity.updatedAt = new Date().toISOString()
            await this.db.tasks.put(await taskEntityToRecord(entity))
            return [newRemindAt, null]
        } catch (err) {
            return [null, String(err)]
        }
    }
}

/**
 * 创建本地任务仓储实例
 */
export const newLocalTaskRepository = () => new LocalTaskRepoImpl()