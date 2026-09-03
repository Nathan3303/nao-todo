/**
 * 数据同步服务
 * @description 编排拉取/推送/冲突（LWW）/游标/重试/时机；唯一与网络打交道的同步模块。
 *              批量接口 POST /sync/pull 与 POST /sync/push（后端已落地，
 *              见 data-sync-plan-backend-implementation.md 阶段 C）。
 *              拉取写入直连表 + converters（不触发 markDirty，避免同步回环）。
 */
import { getRequesterImpl, type Requester } from '@nao-todo/shared'
import { getJWTFromLocalStorage } from '../persistence-go/utils'
import { localDatabase } from '../persistence-local/db/local-database'
import { localSession } from '../persistence-local/session/local-session'
import {
    projectEntityToRecord,
    projectRecordToEntity
} from '../persistence-local/converters/project'
import { tagEntityToRecord, tagRecordToEntity } from '../persistence-local/converters/tag'
import {
    taskCheckItemEntityToRecord,
    taskCheckItemRecordToEntity,
    taskCommentEntityToRecord,
    taskCommentRecordToEntity,
    taskEntityToRecord,
    taskRecordToEntity
} from '../persistence-local/converters/task'
import {
    pomodoroEntityToRecord,
    pomodoroRecordEntityToItem,
    pomodoroRecordItemToEntity,
    pomodoroRecordToEntity
} from '../persistence-local/converters/pomodoro'
import { projectRes2Entity } from '../persistence-go/project/converters'
import { tagRes2Entity } from '../persistence-go/tag/converters'
import {
    taskCheckItemRes2Entity,
    taskCommentRes2Entity,
    taskRes2TaskEntity
} from '../persistence-go/task/converters'
import { pomodoroRecordRes2Entity, pomodoroRes2Entity } from '../persistence-go/pomodoro/converters'
import { setServerTimeOffset } from './sync-config'
import { syncTracker } from './sync-tracker'
import { syncStatus } from './sync-status'
import { isNotDeleted } from '../persistence-local/utils'

// ---------------------------------------------------------------------------
// 同步表配置（7 张业务表；preferences 随父实体、users/userConfigs 走远程用户域，均不入同步）
// ---------------------------------------------------------------------------

interface SyncTableConfig {
    /** 本地表名（= 远程资源名，批量接口的 key） */
    table: string
    /** 远程 res → domain 实体（明文） */
    resToEntity: (res: Record<string, unknown>) => { id: string; updatedAt: string }
    /** domain 实体 → 本地 record（加密落库） */
    entityToRecord: (entity: Record<string, unknown>, userId: string) => Promise<unknown>
    /** 本地 record → domain 实体（解密，供推送） */
    recordToEntity: (record: Record<string, unknown>) => Promise<Record<string, unknown>>
    /** domain 实体 → 推送记录（含 id/createdAt/updatedAt + 业务字段） */
    entityToPush: (entity: Record<string, unknown>) => Record<string, unknown>
}

const buildPush =
    (fields: string[]) =>
    (entity: Record<string, unknown>): Record<string, unknown> => {
        const record: Record<string, unknown> = { id: entity.id }
        for (const field of fields) {
            record[field] = entity[field]
        }
        return record
    }

const SYNC_TABLES: SyncTableConfig[] = [
    {
        table: 'projects',
        resToEntity: projectRes2Entity as unknown as SyncTableConfig['resToEntity'],
        entityToRecord: projectEntityToRecord as unknown as SyncTableConfig['entityToRecord'],
        recordToEntity: projectRecordToEntity as unknown as SyncTableConfig['recordToEntity'],
        entityToPush: buildPush([
            'name',
            'icon',
            'description',
            'archivedAt',
            'deactivedAt',
            'sortId',
            'createdAt',
            'updatedAt',
            'deletedAt'
        ])
    },
    {
        table: 'tags',
        resToEntity: tagRes2Entity as unknown as SyncTableConfig['resToEntity'],
        entityToRecord: tagEntityToRecord as unknown as SyncTableConfig['entityToRecord'],
        recordToEntity: tagRecordToEntity as unknown as SyncTableConfig['recordToEntity'],
        entityToPush: buildPush([
            'icon',
            'name',
            'description',
            'color',
            'sortId',
            'createdAt',
            'updatedAt',
            'deletedAt'
        ])
    },
    {
        table: 'tasks',
        resToEntity: taskRes2TaskEntity as unknown as SyncTableConfig['resToEntity'],
        entityToRecord: taskEntityToRecord as unknown as SyncTableConfig['entityToRecord'],
        recordToEntity: taskRecordToEntity as unknown as SyncTableConfig['recordToEntity'],
        entityToPush: buildPush([
            'parentTaskId',
            'name',
            'description',
            'state',
            'priority',
            'startAt',
            'endAt',
            'projectId',
            'tags',
            'archivedAt',
            'starMarkAt',
            'givenUpAt',
            'remindAt',
            'remindRepeat',
            'remindTime',
            'remindWeekdays',
            'createdAt',
            'updatedAt',
            'deletedAt'
        ])
    },
    {
        table: 'taskCheckItems',
        resToEntity: taskCheckItemRes2Entity as unknown as SyncTableConfig['resToEntity'],
        entityToRecord: taskCheckItemEntityToRecord as unknown as SyncTableConfig['entityToRecord'],
        recordToEntity: taskCheckItemRecordToEntity as unknown as SyncTableConfig['recordToEntity'],
        entityToPush: buildPush([
            'taskId',
            'name',
            'isDone',
            'sortId',
            'createdAt',
            'updatedAt',
            'deletedAt'
        ])
    },
    {
        table: 'taskComments',
        resToEntity: taskCommentRes2Entity as unknown as SyncTableConfig['resToEntity'],
        entityToRecord: taskCommentEntityToRecord as unknown as SyncTableConfig['entityToRecord'],
        recordToEntity: taskCommentRecordToEntity as unknown as SyncTableConfig['recordToEntity'],
        entityToPush: buildPush([
            'taskId',
            'content',
            'attachments',
            'isTopUp',
            'createdAt',
            'updatedAt',
            'deletedAt'
        ])
    },
    {
        table: 'pomodoros',
        resToEntity: pomodoroRes2Entity as unknown as SyncTableConfig['resToEntity'],
        entityToRecord: pomodoroEntityToRecord as unknown as SyncTableConfig['entityToRecord'],
        recordToEntity: pomodoroRecordToEntity as unknown as SyncTableConfig['recordToEntity'],
        entityToPush: buildPush([
            'type',
            'name',
            'description',
            'duration',
            'archivedAt',
            'totalDuration',
            'createdAt',
            'updatedAt',
            'deletedAt'
        ])
    },
    {
        table: 'pomodoroRecords',
        resToEntity: pomodoroRecordRes2Entity as unknown as SyncTableConfig['resToEntity'],
        entityToRecord: pomodoroRecordEntityToItem as unknown as SyncTableConfig['entityToRecord'],
        recordToEntity: pomodoroRecordItemToEntity as unknown as SyncTableConfig['recordToEntity'],
        entityToPush: buildPush([
            'sessionId',
            'pomodoroId',
            'type',
            'taskId',
            'taskName',
            'description',
            'startAt',
            'endAt',
            'duration',
            'note',
            'createdAt',
            'updatedAt',
            'deletedAt'
        ])
    }
]

// ---------------------------------------------------------------------------
// 批量接口响应结构（与后端契约对齐）
// ---------------------------------------------------------------------------

interface PullTableResult {
    items?: Record<string, unknown>[]
    total?: number
    nextCursor?: string | null
    nextCursorId?: string | null
}

interface PushResult {
    table?: string
    id?: string
    serverUpdatedAt?: string
}

// ---------------------------------------------------------------------------
// SyncService
// ---------------------------------------------------------------------------

const PULL_LIMIT = 200
const PUSH_DEBOUNCE_MS = 2000
/** 单实体推送失败重试上限（超限暂停推送，防离线无限重试） */
const MAX_PUSH_RETRY = 5

export class SyncService {
    /** 变更后 2s 防抖推送（同实体重复写合并为最新，见 data-sync-plan.md §4.2） */
    private pushTimer: ReturnType<typeof setTimeout> | null = null

    /** 测试可注入 mock；生产不注入则每次动态取全局 requester（避免模块加载时序捕获到 emptyRequester） */
    private readonly injectedRequester: Requester | null

    /** 同步操作串行队列（pull/push 互斥，避免在途旧版 push 覆盖远程新版，见审查报告缺陷 3） */
    private opChain: Promise<unknown> = Promise.resolve()

    /** 拉取写入本地数据后的回调（装配层注入：通知视图刷新） */
    private dataChangedListener: (() => void) | null = null

    /** 会话失效回调（业务码 10041：凭证验证失败 → 装配层清 JWT 回登录页） */
    private sessionExpiredListener: (() => void) | null = null

    constructor(requester?: Requester) {
        this.injectedRequester = requester ?? null
    }

    /** 注册拉取写入回调（数据变化 → 视图刷新，见 data-sync-plan.md §8 Phase 3） */
    setDataChangedListener(listener: () => void): void {
        this.dataChangedListener = listener
    }

    /** 注册会话失效回调（10041：用户凭证验证失败） */
    setSessionExpiredListener(listener: () => void): void {
        this.sessionExpiredListener = listener
    }

    /** 判定业务码是否为会话失效（用户凭证验证失败） */
    private isSessionExpiredCode(code: unknown): boolean {
        return code === 10041
    }

    /** 触发会话失效回调（不删除本地数据，仅通知装配层清 JWT 回登录页） */
    private notifySessionExpired(): void {
        this.sessionExpiredListener?.()
    }

    /** 排队执行同步操作（前序失败不阻塞后续） */
    private enqueue<T>(op: () => Promise<T>): Promise<T> {
        const run = this.opChain.then(op, op)
        this.opChain = run.catch(() => undefined)
        return run
    }

    private get requester(): Requester {
        return this.injectedRequester ?? getRequesterImpl()
    }

    private authHeaders(): Record<string, string> {
        try {
            return { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        } catch {
            // 无 localStorage 环境（测试）：不带鉴权头
            return {}
        }
    }

    private currentUserId(): string | null {
        return localSession.getCurrentUserId()
    }

    /** 校准服务器时间偏移（响应带回 serverTime，UTC Unix 毫秒；后端可能返回字符串） */
    private calibrateServerTime(serverTime?: number): void {
        if (typeof serverTime === 'number' && Number.isFinite(serverTime) && serverTime > 0) {
            setServerTimeOffset(serverTime - Date.now())
        }
    }

    /** 按表名取 Dexie 表（类型收窄辅助） */
    private tableOf(config: SyncTableConfig): {
        put: (record: unknown) => Promise<unknown>
        get: (id: string) => Promise<Record<string, unknown> | undefined>
    } {
        return localDatabase[config.table as keyof typeof localDatabase] as never
    }

    /**
     * 启动同步（解锁后调用，先拉后推；经串行队列与防抖/手动同步互斥）
     * @description 注销反悔期内跳过（反悔期内不同步，见 data-sync-plan.md §6）
     */
    async start(): Promise<void> {
        return this.enqueue(async () => {
            const userId = this.currentUserId()
            if (!userId) {
                // 无会话：标记同步结束（空计数），避免调用方（如 InitialSyncGate）永久停留在同步中
                await this.refreshCounts()
                return
            }
            // 注销反悔期：deletionSchedules 有调度记录则跳过启动
            const schedule = await localDatabase.deletionSchedules.get(userId)
            if (schedule) {
                await this.refreshCounts()
                return
            }
            await this.pullAllInner()
            await this.pushAllInner()
        })
    }

    /** 拉取全部同步表（每表 keyset 游标增量，LWW 冲突判定） */
    async pullAll(): Promise<void> {
        return this.enqueue(() => this.pullAllInner())
    }

    /** 拉取全部同步表（串行队列内执行） */
    private async pullAllInner(): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        syncStatus.markSyncing()
        const pullBody: Record<string, Record<string, unknown>> = {}
        for (const config of SYNC_TABLES) {
            const cursor = await localDatabase.syncCursor.get(`${userId}:${config.table}`)
            pullBody[config.table] = {
                updatedAt: cursor?.lastPullAt ?? '',
                cursorId: cursor?.lastPullId ?? '',
                limit: PULL_LIMIT
            }
        }
        let response
        try {
            response = await this.requester.post('/sync/pull', pullBody, {
                headers: this.authHeaders()
            })
        } catch (err) {
            // HTTP 4xx/5xx：区分鉴权失败（不误报网络错误，提示重新登录）
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 401 || status === 403) {
                console.error('[sync] 拉取被拒绝：登录已过期（401/403）', status)
                await this.refreshCounts('拉取失败：登录已过期，请重新登录')
            } else {
                console.error('[sync] 拉取请求失败（网络/HTTP 错误）', err)
                await this.refreshCounts('拉取失败：网络错误')
            }
            return
        }
        // 归一化网络错误检测：requester 对断网/超时不 reject，而是 resolve 顶层携带字符串 code 的归一化响应，
        // 不识别会被当作"空数据成功"静默吞掉（见审查报告缺陷 1）
        const raw = response as { code?: unknown; data?: unknown } | undefined
        const data = raw?.data as { data?: unknown; serverTime?: string | number } | undefined
        // 业务码 10041（用户凭证验证失败）：HTTP 可能仍为 200，须在归一化检测前识别
        if (this.isSessionExpiredCode((data as { code?: unknown })?.code)) {
            console.error('[sync] 拉取被拒绝：用户凭证验证失败（10041）')
            this.notifySessionExpired()
            await this.refreshCounts('登录已过期，请重新登录')
            return
        }
        if (typeof raw?.code === 'string' || data?.data === null) {
            console.error('[sync] 拉取归一化错误（断网/超时）', raw?.code)
            await this.refreshCounts('拉取失败：网络错误')
            return
        }
        this.calibrateServerTime(Number((data as { serverTime?: string | number }).serverTime))
        // 后端结构：response.data = { code, message, data: { data: { [table]: { items, total, nextCursor, nextCursorId } } }, serverTime }
        const inner = (data?.data as { data?: Record<string, PullTableResult> } | undefined)?.data
        const results = inner ?? {}
        let writtenCount = 0
        for (const config of SYNC_TABLES) {
            const result = results[config.table]
            if (!result?.items) continue
            writtenCount += await this.applyPullBatch(config, result)
        }
        await this.refreshCounts()
        // 有实际写入（新增/覆盖/删除墓碑）→ 通知视图刷新（store 缓存绕过，需事件驱动重拉）
        if (writtenCount > 0) {
            this.notifyDataChanged()
        }
    }

    /** 派发数据变化事件（防御无 window 环境） */
    private notifyDataChanged(): void {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nao-todo:data-changed'))
        }
        this.dataChangedListener?.()
    }

    /** 刷新待推送/失败计数并结束同步状态（供 UI 展示） */
    private async refreshCounts(lastError: string | null = null): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) {
            syncStatus.markSynced({ pendingCount: 0, failedCount: 0, lastError })
            return
        }
        syncStatus.markSynced({
            pendingCount: await syncTracker.countDirty(userId),
            failedCount: await syncTracker.countFailed(userId),
            lastError
        })
    }

    /** 应用一批拉取记录（LWW 判定后加密落库，直连表不触发 markDirty）
     *  @returns 本批实际写入（含覆盖/删除墓碑）的记录数 */
    private async applyPullBatch(
        config: SyncTableConfig,
        result: PullTableResult
    ): Promise<number> {
        const userId = this.currentUserId()
        if (!userId) return 0
        const records = result.items ?? []
        let written = 0
        for (const res of records) {
            const entity = config.resToEntity(res) as Record<string, unknown>
            const id = String((entity.id as string | number) ?? '')
            if (!id) continue
            // 时间比较统一转 UTC ms：远程时间戳可能带 +08:00 / Z 等不同时区后缀，字典序比较会误判 LWW
            const remoteTs = Date.parse(String((entity.updatedAt as string) ?? '')) || 0
            // 冲突判定：本地有未推送修改（在 syncQueue）时比较 updatedAt（LWW）
            const queued = await localDatabase.syncQueue.get(`${userId}:${config.table}:${id}`)
            if (queued) {
                const localTs = Date.parse(queued.localUpdatedAt) || 0
                if (remoteTs > localTs) {
                    // 远程胜：覆盖本地 + 移除队列项（本地修改作废）
                    await this.tableOf(config).put(await config.entityToRecord(entity, userId))
                    await syncTracker.removeQueued(config.table, id)
                    written += 1
                }
                // 本地胜：跳过（保留 queue，交给推送）
            } else {
                // 本地未改：远程胜直接覆盖（含删除墓碑）
                await this.tableOf(config).put(await config.entityToRecord(entity, userId))
                written += 1
            }
        }
        // 推进游标（keyset：只前进不后退；尾页无 nextCursor 时推进到本批最大 updatedAt，
        // 避免每轮同步从旧游标重拉重放，见审查报告缺陷 5）
        const cursorId = `${userId}:${config.table}`
        const existing = await localDatabase.syncCursor.get(cursorId)
        const batchMaxUpdatedAt = records.reduce((max, res) => {
            const ts = String((res as { updatedAt?: string }).updatedAt ?? '')
            return ts > max ? ts : max
        }, existing?.lastPullAt ?? '')
        await localDatabase.syncCursor.put({
            id: cursorId,
            userId,
            table: config.table,
            lastPullAt: result.nextCursor ?? batchMaxUpdatedAt,
            lastPullId: result.nextCursorId ?? '',
            updatedAt: new Date().toISOString()
        })
        return written
    }

    /**
     * 重算常用专注的累计专注时长（手动兑底工具）
     * @description Phase 2 策略：信任远程 totalDuration 字段为主（后端原子维护，见 data-sync-plan.md §5），
     *              拉取不再自动重算；本方法供手动触发（如本地积压清理后校准）。
     *              sum 该 pomodoro 下未删除记录 duration（排除删除墓碑）；不触发 markDirty。
     */
    async recalculateTotalDurations(ids: string[], userId?: string): Promise<void> {
        const uid = userId ?? this.currentUserId()
        if (!uid) return
        for (const id of ids) {
            const pomodoro = await localDatabase.pomodoros.get(id)
            if (!pomodoro || pomodoro.userId !== uid) continue
            const records = await localDatabase.pomodoroRecords
                .where('pomodoroId')
                .equals(id)
                .filter((r) => r.userId === uid && isNotDeleted(r.deletedAt))
                .toArray()
            const total = records.reduce((sum, r) => sum + (r.duration ?? 0), 0)
            if (pomodoro.totalDuration !== total) {
                pomodoro.totalDuration = total
                await localDatabase.pomodoros.put(pomodoro)
            }
        }
    }

    /** 推送脏队列（批量 upsert + deletions，幂等） */
    async pushAll(): Promise<void> {
        return this.enqueue(() => this.pushAllInner())
    }

    /** 推送脏队列（串行队列内执行） */
    private async pushAllInner(): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        syncStatus.markSyncing()
        const queue = await syncTracker.listDirty(userId)
        if (queue.length === 0) {
            await this.refreshCounts()
            return
        }

        const pushBody: Record<string, Record<string, unknown>[]> = {}
        const deletions: { table: string; id: string }[] = []
        // 发送前快照各实体 localUpdatedAt：确认后仅当队列项未被推送期间的新修改覆盖才移除，
        // 否则保留下轮重推，避免本地修改被误删丢失（见审查报告缺陷 2）
        const snapshots = new Map<string, string>()
        for (const item of queue) {
            // 重试上限：retryCount 超限暂停推送（避免离线时无限重试堆积请求），状态经 SyncStatus 暴露
            if (item.retryCount >= MAX_PUSH_RETRY) continue
            const config = SYNC_TABLES.find((c) => c.table === item.table)
            if (!config) continue
            snapshots.set(`${item.table}:${item.entityId}`, item.localUpdatedAt)
            const record = await this.tableOf(config).get(item.entityId)
            if (!record) {
                // 本地记录已不存在（物理清理）：按删除推送兜底
                deletions.push({ table: item.table, id: item.entityId })
                continue
            }
            if (item.action === 'delete') {
                deletions.push({ table: item.table, id: item.entityId })
                continue
            }
            const entity = await config.recordToEntity(record)
            const target = (pushBody[item.table] ??= [])
            target.push({ id: item.entityId, ...config.entityToPush(entity) })
        }
        if (Object.keys(pushBody).length === 0 && deletions.length === 0) return

        console.log(
            '[sync] 推送请求 /sync/push 样本',
            JSON.stringify({
                firstItem: Object.values(pushBody)[0]?.[0] ?? null,
                deletions
            })
        )
        let response
        try {
            response = await this.requester.post(
                '/sync/push',
                { ...pushBody, deletions },
                { headers: this.authHeaders() }
            )
        } catch (err) {
            // HTTP 4xx/5xx：区分鉴权失败（不累加 retryCount，避免推送被 5 次上限永久暂停）
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 401 || status === 403) {
                console.error('[sync] 推送被拒绝：登录已过期（401/403）', status)
                await this.refreshCounts('推送失败：登录已过期，请重新登录')
            } else {
                console.error('[sync] 推送请求失败（网络/HTTP 错误）', err)
                for (const item of queue) {
                    if (snapshots.has(`${item.table}:${item.entityId}`)) {
                        await syncTracker.markFailed(item.id)
                    }
                }
                await this.refreshCounts('推送失败：网络错误')
            }
            return
        }
        // 归一化网络错误检测（断网/超时 resolve 场景，见审查报告缺陷 1）
        const raw = response as { code?: unknown; data?: unknown }
        // 业务码 10041（用户凭证验证失败）：HTTP 可能仍为 200，须在归一化检测前识别
        const dataRaw = raw?.data as { code?: unknown } | undefined
        if (this.isSessionExpiredCode(dataRaw?.code)) {
            console.error('[sync] 推送被拒绝：用户凭证验证失败（10041）')
            this.notifySessionExpired()
            await this.refreshCounts('登录已过期，请重新登录')
            return
        }
        if (typeof raw?.code === 'string') {
            console.error('[sync] 推送归一化错误（断网/超时）', raw?.code)
            for (const item of queue) {
                if (snapshots.has(`${item.table}:${item.entityId}`)) {
                    await syncTracker.markFailed(item.id)
                }
            }
            await this.refreshCounts('推送失败：网络错误')
            return
        }
        const data = (raw?.data as { data?: { results?: PushResult[] }; serverTime?: number }) ?? {}
        console.log('[sync] 推送响应', JSON.stringify(response?.data))
        this.calibrateServerTime((data as { serverTime?: number }).serverTime)
        const results = data.data?.results ?? []
        const pushed = new Set(results.map((r) => `${r.table}:${r.id}`))
        for (const item of queue) {
            if (pushed.has(`${item.table}:${item.entityId}`)) {
                const snapshot = snapshots.get(`${item.table}:${item.entityId}`)
                // 推送期间本地对同一实体有新修改（localUpdatedAt 已变化）：保留队列项下轮重推，防止本地修改丢失
                const current = await localDatabase.syncQueue.get(item.id)
                if (current && snapshot !== undefined && current.localUpdatedAt === snapshot) {
                    await syncTracker.removeQueued(item.table, item.entityId)
                }
            } else {
                // 响应中无该实体：后端拒绝或字段不匹配，标记失败并记录响应便于诊断
                if (snapshots.has(`${item.table}:${item.entityId}`)) {
                    console.warn('[sync] 推送未确认的实体', {
                        table: item.table,
                        id: item.entityId
                    })
                    await syncTracker.markFailed(item.id)
                }
            }
        }
        await this.refreshCounts()
    }

    /** 变更后 2s 防抖推送 */
    schedulePush(): void {
        if (this.pushTimer) clearTimeout(this.pushTimer)
        this.pushTimer = setTimeout(() => {
            this.pushTimer = null
            void this.pushAll()
        }, PUSH_DEBOUNCE_MS)
    }

    /** 手动完整同步（拉取全部 + 推送全部，供 UI 触发） */
    async manualSync(): Promise<void> {
        await this.pullAll()
        await this.pushAll()
    }
}

/** 同步服务单例 */
export const syncService = new SyncService()