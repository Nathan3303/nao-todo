import type { Pagination } from '@nao-todo/shared/types/pagination'
import {
    CreateTaskValueObject,
    prioritySNMap,
    TASK_PRIORITIES,
    TaskEntity,
    TaskRepository,
    UpdateTaskValueObject
} from '@nao-todo/domain-task'
import type { TaskUpdateOrigin } from '@nao-todo/domain-task'
import type { GoAsync } from '@nao-todo/shared'
import dayjs from 'dayjs'
import {
    taskCheckItemEntityToRecord,
    taskCheckItemRecordToEntity,
    taskCommentEntityToRecord,
    taskCommentRecordToEntity,
    taskEntityToRecord,
    taskRecordToEntity
} from '../converters/task'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { putWithSyncBase, putWithSyncBaseAndEnqueue } from './put-with-sync-base'
import { cascadeProjectArchive } from './project-archive-cascade'
import { localSession } from '../session/local-session'
import { isAbsentStamp, isNotDeleted } from '../utils'
import { snowflake } from '../../persistence-sync/snowflake'
import { nowCalibratedIso } from '../../persistence-sync/sync-config'
import { pickOverwrittenFields, recordEditOverwrite } from '../../persistence-sync/edit-overwrite'
import { deriveAuditAction, diffAuditFields, recordAudit } from '../../persistence-sync/audit-log'
import { captureFieldBase } from '../../persistence-sync/field-base'
import { syncTracker } from '../../persistence-sync/sync-tracker'

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
 * @description 负向条件（-today/-overdue）下无截止时间的任务视为保留（不误过滤）；
 *              正向条件（today/tomorrow/week/month）下无截止时间不匹配。
 */
const matchRelativeDate = (endAt: string, relativeDate: string): boolean => {
    const d = dayjs(endAt)
    if (!d.isValid()) return relativeDate.startsWith('-')
    const now = dayjs()
    switch (relativeDate) {
        case 'today':
            // 今日任务：结束日期在今天及之后（未到期）都算——今天内还可继续完成；
            // 今天到期的任务也包含（今天结束前都未过期）
            return !d.isBefore(now.startOf('day'))
        case 'tomorrow':
            return d.isSame(now.add(1, 'day'), 'day')
        case 'week':
            return d.isSame(now, 'week')
        case 'month':
            return d.isSame(now, 'month')
        case '-today':
            return d.isBefore(now.startOf('day'))
        case '-overdue':
            // 未逾期（endAt 为未来/当下）保留；已逾期排除
            return !d.isBefore(now)
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

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.requireCurrentUserId()
    }

    /**
     * 本机编辑的审计记账（旁路）
     * @description 调用时机 = **业务事务提交之后**（`recordAudit` 内部兜住失败、不抛、不阻断）；
     *              判据 = 「落库前后实体是否真的变了」（`diffAuditFields` 非空）**或**动作变化
     *              （归档 / 取消归档）⇒ 同值再写 = 0 条（`R-2` / `AC1`）。
     *              值一律取**实体层明文**（⛔ 记录层形状；`T676` 教训）。
     */
    private async recordLocalEditAudit(before: object, after: object & { id: string }) {
        const action = deriveAuditAction(before, after)
        const fields = diffAuditFields(before, after)
        if (action === 'update' && fields.length === 0) return
        await recordAudit({ entityId: after.id, action, source: 'local-edit', fields })
    }

    async get(id: string): GoAsync<TaskEntity> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record || record.userId !== this.currentUserId) return [null, '任务不存在']
            return [await taskRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async create(createVO: CreateTaskValueObject): GoAsync<TaskEntity> {
        try {
            const now = nowCalibratedIso()
            const entity = new TaskEntity(
                snowflake.nextId(),
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
                createVO.remindWeekdays ?? [],
                0,
                0,
                0,
                createVO.sortId ?? 0
            )
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.tasks,
                'tasks',
                await taskEntityToRecord(entity, this.currentUserId),
                'upsert',
                entity.updatedAt
            )
            // 旁路审计（`AC1` / PM 2026-11-11 裁定：创建也记 1 条，`fields` 为空 = 不产字段噪声）
            await recordAudit({ entityId: entity.id, action: 'create', source: 'local-edit' })
            return [entity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async update(
        id: string,
        updateVO: UpdateTaskValueObject,
        editOrigin?: TaskUpdateOrigin
    ): GoAsync<void> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record || record.userId !== this.currentUserId) return '任务不存在'
            const entity = await taskRecordToEntity(record)
            // T676 / M1：字段级基准（`B`）= 本次写前的**明文**旧值。
            // ⚠️ 必须在实体层捕获：`name`/`description` 落库为 `plain:<明文>`，与同步边界（实体）不同形状。
            const entityBefore = Object.assign({}, entity)
            // DEF-146：写前取 `R`（库中云端当前值）并完成三值判定；⛔ 必须在任何字段赋值之前
            const overwrittenFields = pickOverwrittenFields(
                entity as unknown as Record<string, unknown>,
                updateVO as unknown as Record<string, unknown>,
                editOrigin as Record<string, unknown> | undefined
            )
            // 被覆盖字段的云端值快照（entity 即将被改写 ⇒ 先拍下来，供写后记账用）
            const cloudFields: Record<string, unknown> = {}
            for (const field of overwrittenFields) {
                cloudFields[field] = (entity as unknown as Record<string, unknown>)[field]
            }
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
            if (updateVO.starMarkAt !== undefined) entity.starMarkAt = updateVO.starMarkAt
            if (updateVO.remindAt !== undefined) entity.remindAt = updateVO.remindAt ?? ''
            if (updateVO.remindRepeat !== undefined) entity.remindRepeat = updateVO.remindRepeat
            if (updateVO.remindTime !== undefined) entity.remindTime = updateVO.remindTime ?? ''
            if (updateVO.remindWeekdays !== undefined)
                entity.remindWeekdays = updateVO.remindWeekdays
            if (updateVO.sortId !== undefined) entity.sortId = updateVO.sortId
            if (updateVO.archivedAt !== undefined) entity.archivedAt = updateVO.archivedAt
            entity.updatedAt = nowCalibratedIso()
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.tasks,
                'tasks',
                await taskEntityToRecord(entity, this.currentUserId),
                'upsert',
                entity.updatedAt,
                captureFieldBase(entityBefore, entity)
            )
            // R-5：记账在保存事务**之后**；失败只 log（`recordEditOverwrite` 内部兜住、不抛出）
            if (overwrittenFields.length > 0) {
                await recordEditOverwrite({
                    userId: this.currentUserId,
                    table: 'tasks',
                    entityId: id,
                    cloud: cloudFields,
                    fields: overwrittenFields,
                    winnerUpdatedAt: entity.updatedAt
                })
            }
            // 旁路审计：落库前后实体比对（动作由 archivedAt 前后变化派生）
            await this.recordLocalEditAudit(entityBefore, entity)
            return null
        } catch (err) {
            return String(err)
        }
    }

    async remove(id: string): GoAsync<void> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record || record.userId !== this.currentUserId) return '任务不存在'
            const entity = await taskRecordToEntity(record)
            entity.deletedAt = nowCalibratedIso()
            entity.updatedAt = entity.deletedAt
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.tasks,
                'tasks',
                await taskEntityToRecord(entity, this.currentUserId),
                'delete',
                entity.deletedAt ?? entity.updatedAt
            )
            // 旁路审计：动作 = 删除（`deletedAt` 不进 `fields`，`AC7`）
            await recordAudit({ entityId: id, action: 'delete', source: 'local-edit' })
            // 级联软删：子任务（递归）+ 检查项 + 评论（与删除一起入队，防远程残留孤儿子实体，见 data-sync-plan.md §5）
            await this.cascadeRemove(id, entity.deletedAt)
            return null
        } catch (err) {
            return String(err)
        }
    }

    /**
     * 级联软删任务关联子实体（子任务递归、检查项、评论）
     * @description 本地与远程删除均为软删墓碑；级联删除保证远程不残留孤儿（任务删除连带子实体 delete 入队）；
     *              visited 集合防历史脏数据（父子环）导致递归死循环
     */
    private async cascadeRemove(
        taskId: string,
        deletedAt: string,
        visited: Set<string> = new Set()
    ): Promise<void> {
        if (visited.has(taskId)) return
        visited.add(taskId)
        // 子任务（递归）
        const subtasks = await this.db.tasks
            .where('parentTaskId')
            .equals(taskId)
            .filter((r) => r.userId === this.currentUserId && isNotDeleted(r.deletedAt))
            .toArray()
        for (const sub of subtasks) {
            const subEntity = await taskRecordToEntity(sub)
            subEntity.deletedAt = deletedAt
            subEntity.updatedAt = deletedAt
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.tasks,
                'tasks',
                await taskEntityToRecord(subEntity, this.currentUserId),
                'delete',
                deletedAt
            )
            // 旁路审计：子任务也是 `tasks` 实体（`R-8` 只记 tasks；检查项 / 评论本批不记）
            await recordAudit({ entityId: subEntity.id, action: 'delete', source: 'local-edit' })
            await this.cascadeRemove(sub.id, deletedAt)
        }
        // 检查项
        const checkItems = await this.db.taskCheckItems
            .where('taskId')
            .equals(taskId)
            .filter((r) => r.userId === this.currentUserId && isNotDeleted(r.deletedAt))
            .toArray()
        for (const item of checkItems) {
            const itemEntity = await taskCheckItemRecordToEntity(item)
            itemEntity.deletedAt = deletedAt
            itemEntity.updatedAt = deletedAt
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.taskCheckItems,
                'taskCheckItems',
                await taskCheckItemEntityToRecord(itemEntity, this.currentUserId),
                'delete',
                deletedAt
            )
        }
        // 评论
        const comments = await this.db.taskComments
            .where('taskId')
            .equals(taskId)
            .filter((r) => r.userId === this.currentUserId && isNotDeleted(r.deletedAt))
            .toArray()
        for (const comment of comments) {
            const commentEntity = await taskCommentRecordToEntity(comment)
            commentEntity.deletedAt = deletedAt
            commentEntity.updatedAt = deletedAt
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.taskComments,
                'taskComments',
                await taskCommentEntityToRecord(commentEntity, this.currentUserId),
                'delete',
                deletedAt
            )
        }
    }

    async restore(id: string): GoAsync<void> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record || record.userId !== this.currentUserId) return '任务不存在'
            const entity = await taskRecordToEntity(record)
            entity.deletedAt = null
            entity.updatedAt = nowCalibratedIso()
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.tasks,
                'tasks',
                await taskEntityToRecord(entity, this.currentUserId),
                'upsert',
                entity.updatedAt
            )
            // 旁路审计：动作 = 恢复（`deletedAt` 复原不产字段噪声，`AC7`）
            await recordAudit({ entityId: id, action: 'restore', source: 'local-edit' })
            return null
        } catch (err) {
            return String(err)
        }
    }

    async archiveByProjectId(projectId: string): GoAsync<void> {
        // 清单 + 其下任务同事务级联（ADR §4 Q1 / PA-5/PA-6/PA-7）
        return await cascadeProjectArchive(this.db, projectId, this.currentUserId, 'archive')
    }

    async unarchiveByProjectId(projectId: string): GoAsync<void> {
        return await cascadeProjectArchive(this.db, projectId, this.currentUserId, 'unarchive')
    }

    /**
     * 单任务「取消归档」（脱归档）
     * @description 同一 Dexie `rw` 事务内读任务 + 读其清单归档态（无 TOCTOU）：
     *              清单仍归档 ⇒ `movedToInbox=true` + `archivedAt=null` + `projectId='inbox'`；
     *              清单已恢复 ⇒ `movedToInbox=false`，`projectId` 不变。
     *              `archivedAt` 严格写 `null`、收集箱写**字面 `'inbox'`**（ADR §15.1 / Q4）。
     */
    async unarchive(id: string): GoAsync<{ movedToInbox: boolean }> {
        try {
            const outcome = await this.db.transaction(
                'rw',
                this.db.tasks,
                this.db.projects,
                this.db.syncQueue,
                async () => {
                    const record = await this.db.tasks.get(id)
                    if (!record || record.userId !== this.currentUserId)
                        return { ok: false as const, message: '任务不存在' }
                    // 判据 = 任务所属清单当前是否归档（读项目行，非任务推导；PA-10 禁止清单二次推导）
                    const project = record.projectId
                        ? await this.db.projects.get(record.projectId)
                        : undefined
                    const movedToInbox = !isAbsentStamp(project?.archivedAt)
                    const now = nowCalibratedIso()
                    const nextTask = {
                        ...record,
                        archivedAt: null,
                        projectId: movedToInbox ? 'inbox' : record.projectId,
                        updatedAt: now
                    }
                    const fieldBase = captureFieldBase(record, nextTask)
                    await putWithSyncBase(this.db.tasks, nextTask)
                    await syncTracker.markDirty(
                        'tasks',
                        id,
                        'upsert',
                        now,
                        this.db.syncQueue,
                        fieldBase
                    )
                    return {
                        ok: true as const,
                        movedToInbox,
                        // 审计用：脱归档前后的清单归属（结构字段 ⇒ 记录层与实体层同形）
                        previousProjectId: record.projectId,
                        nextProjectId: nextTask.projectId
                    }
                }
            )
            if (!outcome.ok) return [null, outcome.message]
            // 旁路审计在业务事务之后（⛔ 审计不进 Dexie 事务）；动作 = 脱归档，
            // 仅当回收集箱（清单归属变化）时 `fields` 只含 `projectId`（`T696` §3.1）
            await recordAudit({
                entityId: id,
                action: 'unarchive',
                source: 'local-edit',
                fields: diffAuditFields(
                    { projectId: outcome.previousProjectId },
                    { projectId: outcome.nextProjectId }
                )
            })
            return [{ movedToInbox: outcome.movedToInbox }, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async list(
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: Pagination }> {
        try {
            const query = parseListQuery(queryString)
            // 1. 结构字段过滤（明文，走索引语义；先按当前用户隔离）
            let records = await this.db.tasks.where('userId').equals(this.currentUserId).toArray()
            if (query.isDeleted === 'true') {
                records = records.filter((r) => !isNotDeleted(r.deletedAt))
            } else {
                // 默认（未传）或 isDeleted=false：不查询已删除任务（含子任务——行级过滤，父/子一视同仁；对齐项目仓库默认语义）
                records = records.filter((r) => isNotDeleted(r.deletedAt))
            }
            if (query.includeArchived === 'true') {
                // P2 / ADR §15.2：`includeArchived=true` ⇒ **不按归档态过滤**（包含已归档），
                // 优先级高于 `isArchived`（正向信号，覆盖 L1 默认排除）
            } else if (query.isArchived === 'true') {
                records = records.filter((r) => !isAbsentStamp(r.archivedAt))
            } else {
                // L1（ADR §3.2 / Q2）：`isArchived` 未传 ⇒ **默认排除归档**（视同 'false'）
                // ⇒ 单一杠杆覆盖清单视图 + 内置视图；显式 'true' 才包含
                records = records.filter((r) => isAbsentStamp(r.archivedAt))
            }
            if (query.isStarMarked === 'true') {
                records = records.filter((r) => !isAbsentStamp(r.starMarkAt))
            } else if (query.isStarMarked === 'false') {
                records = records.filter((r) => isAbsentStamp(r.starMarkAt))
            }
            // 已放弃判定：givenUpAt 非空且为有效日期（undefined/null/'' 均视为未放弃，
            // 规避 dayjs(undefined) 视为当前时间的陷阱）
            const isGivenUp = (r: { givenUpAt: string | null }) =>
                Boolean(r.givenUpAt) && dayjs(r.givenUpAt).isValid()
            if (query.isGivenUp === 'true') {
                records = records.filter(isGivenUp)
            } else {
                // 未传（普通视图默认）或 isGivenUp=false：不查询已放弃任务
                records = records.filter((r) => !isGivenUp(r))
            }
            // state 支持逗号分隔多值（与后端语义一致，如 'todo,in-progress'）
            if (query.state) {
                const states = query.state.split(',').filter(Boolean)
                records = records.filter((r) => states.includes(r.state))
            }
            if (query.priority) {
                // priority 支持逗号分隔多值（与 state 一致，如 'high,urgent'）
                const priorities = query.priority.split(',').filter(Boolean)
                records = records.filter((r) => {
                    if (priorities.includes(r.priority)) return true
                    // R-J（PRD `2026-11-01-kanban-column-paging` D1）：含 `low` 时把 `prioritySNMap`
                    // 白名单外的**脏值**（null / '' / 未知串）也归入 low —— 看板「低」列按列查库后
                    // 脏值否则会消失（`t608-ac4` 回归）。⚠️ 有意行为变化：列表 / 表格按「低」筛选
                    // 也会带出脏值（更正确，已记入 `v1.16.2` 发版说明「请留意」）。
                    // 读取归类 ≠ 写回归一：库中原值不动，只有真拖拽落列时才写入合法档位。
                    return (
                        priorities.includes('low') &&
                        !(TASK_PRIORITIES as readonly string[]).includes(r.priority)
                    )
                })
            }
            if (query.projectId) records = records.filter((r) => r.projectId === query.projectId)
            // 未传 parentTaskId 时默认只查顶层任务（parentTaskId 为空），
            // 子任务仅在任务详情面板按 parentTaskId 查询（与后端语义一致）
            const parentTaskId = query.parentTaskId ?? ''
            records = records.filter((r) => r.parentTaskId === parentTaskId)
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
            // 4. 排序（sort 格式为 field:order，与 domain 层序列化及后端契约一致，如 createdAt:desc）
            if (query.sort) {
                const sep = query.sort.indexOf(':')
                if (sep > 0) {
                    const field = query.sort.slice(0, sep)
                    const order = query.sort.slice(sep + 1)
                    const dir = order === 'desc' ? -1 : 1
                    // DEF-11：priority 按**语义序**（紧急 → 高 → 中 → 低）比较，不用字符串字母序。
                    // 序的单一来源 = domain 既有 `prioritySNMap`；非白名单值（'' / 其它脏值）
                    // 与 low 同档，与视图转换层 `DEFAULT_TASK_PRIORITY` 的兜底口径一致。
                    // 同档返回 0 ⇒ 交给 Array#sort 的稳定性保持既有次序（不抖动）。
                    const isPrioritySort = field === 'priority'
                    const priorityRank = (value: unknown): number =>
                        (prioritySNMap as Record<string, number>)[String(value)] ??
                        prioritySNMap.low
                    result.sort((a, b) => {
                        const av = (a as unknown as Record<string, unknown>)[field]
                        const bv = (b as unknown as Record<string, unknown>)[field]
                        if (av === bv) return 0
                        if (av === null || av === undefined) return 1
                        if (bv === null || bv === undefined) return -1
                        if (isPrioritySort) return (priorityRank(av) - priorityRank(bv)) * dir
                        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
                        return (
                            String(av as string | number | boolean).localeCompare(
                                String(bv as string | number | boolean)
                            ) * dir
                        )
                    })
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
            if (!record || record.userId !== this.currentUserId) return [null, '任务不存在']
            const entity = await taskRecordToEntity(record)
            const now = nowCalibratedIso()
            const copyEntity = new TaskEntity(
                snowflake.nextId(),
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
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.tasks,
                'tasks',
                await taskEntityToRecord(copyEntity, this.currentUserId),
                'upsert',
                copyEntity.updatedAt
            )
            // 旁路审计：复制 = 新建一个实体（`fields` 为空）
            await recordAudit({ entityId: copyEntity.id, action: 'create', source: 'local-edit' })
            return [copyEntity, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async snooze(id: string, durationMinutes: number): GoAsync<string> {
        try {
            const record = await this.db.tasks.get(id)
            if (!record || record.userId !== this.currentUserId) return [null, '任务不存在']
            const entity = await taskRecordToEntity(record)
            // T676 / M1：字段级基准在实体层捕获（同 `update`：密文字段与同步边界同形状）
            const entityBefore = Object.assign({}, entity)
            const newRemindAt = dayjs().add(durationMinutes, 'minute').toISOString()
            entity.remindAt = newRemindAt
            // 同步提醒时刻：DateSelector 显示条件要求 remindTime 非空（task-date-selector.vue），
            // Snooze 场景任务常无 remindTime，不同步会导致详情面板不显示下一次提醒时间
            entity.remindTime = dayjs(newRemindAt).format('HH:mm')
            entity.updatedAt = nowCalibratedIso()
            await putWithSyncBaseAndEnqueue(
                this.db,
                this.db.tasks,
                'tasks',
                await taskEntityToRecord(entity, this.currentUserId),
                'upsert',
                entity.updatedAt,
                captureFieldBase(entityBefore, entity)
            )
            // 旁路审计：提醒组字段（`remindAt` / `remindTime`）走 `fields`
            await this.recordLocalEditAudit(entityBefore, entity)
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