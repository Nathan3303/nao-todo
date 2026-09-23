/**
 * 数据同步服务
 * @description 编排拉取/推送/冲突（LWW）/游标/重试/时机；唯一与网络打交道的同步模块。
 *              批量接口 POST /sync/pull 与 POST /sync/push（后端已落地，
 *              见 data-sync-plan-backend-implementation.md 阶段 C）。
 *              拉取写入直连表 + converters（不触发 markDirty，避免同步回环）。
 */
import { getRequesterImpl, type Requester } from '@nao-todo/shared'
import { getJWTFromLocalStorage } from '../persistence-go/utils'
import { localDatabase, type SyncQueueRecord } from '../persistence-local/db/local-database'
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
import { loadMirrorStatus, saveMirrorStatus } from './mirror-status-store'
import { syncTracker } from './sync-tracker'
import { syncStatus, type SyncPhase, type SyncRunResult } from './sync-status'
import {
    backoffDelayMs,
    classifyPushFailure,
    computeBackfillDelayMs,
    isQueueOverLimit,
    isRetryDue
} from './sync-retry'
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

/**
 * 构建任务推送记录
 * @description `sortId = 0` 表示未设置（服务端分配）⇒ 不产出该字段，
 *              否则存量本地记录的 0 会在服务端覆盖分支把组内序清零（ADR B1 / G4）。
 */
const buildTaskPush = (entity: Record<string, unknown>): Record<string, unknown> => {
    const record = buildPush([
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
        'sortId',
        'createdAt',
        'updatedAt',
        'deletedAt'
    ])(entity)
    if (!record.sortId) delete record.sortId
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
        entityToPush: buildTaskPush
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

/** 单表续拉游标状态（DEF-6）：`updatedAt/cursorId` 为**本轮请求**游标，`lastEnd*` 为上一页**原始**末尾 */
interface PullCursorState {
    updatedAt: string
    cursorId: string
    lastEndAt: string
    lastEndId: string
}

// ---------------------------------------------------------------------------
// SyncService
// ---------------------------------------------------------------------------

const PULL_LIMIT = 200
/**
 * 续拉上界（DEF-6 护栏 A / arch R2）：每表 ≤10 轮（=2000 行）
 * @description 墓碑计入窗口（`.Unscoped()`）⇒ 续拉轮数可能远大于存活行数，必须有界。
 */
const PULL_MAX_ROUNDS = 10
/**
 * 续拉时间预算（DEF-6 护栏 A / arch A5）：总预算 5s，与轮数上界**先到者**生效
 * @description wall-clock 语义：度量「用户可见启动阻塞时延」（非纯网络耗时）⇒ 慢本地处理也计入。
 *              ⚠️ **生产调用点必须保持默认值**（禁按设备动态放宽，否则「启动阻塞上界」失效）；
 *              `SyncServiceOptions` 的注入面**仅限测试**。
 */
const PULL_TIME_BUDGET_MS = 5000

/**
 * 续拉上界覆盖（DEF-6 护栏 A）
 * @description **仅测试注入**：测试环境（fake-indexeddb + WebCrypto）单行落库 ~10ms，与真实浏览器差异大 ⇒
 *              完成路径测试注入更宽预算、截断路径测试注入更小上界，使判定确定可复现。
 *              ⚠️ **生产代码不得传该参数**（必须走默认 `PULL_MAX_ROUNDS` / `PULL_TIME_BUDGET_MS`）。
 */
export interface SyncServiceOptions {
    pullMaxRounds?: number
    pullTimeBudgetMs?: number
}
/**
 * 拉取请求游标回拉窗口（DEF-SYNC-05 缺陷2）
 * @description 服务端 keyset 为**严格** `updated_at > cursor`（`query/sync.go:26-36`）：
 *              当某行 bump 后的 `updated_at` ≤ 客户端已存游标时（同秒毫秒级差、
 *              时间戳秒级截断、同 ms 且 id 更小）会被静默跳过且永不重拉。
 *              故请求时按**瞬时**回拉 Δ 幂等重放补齐窗口；存储游标仍只前进不后退。
 */
const PULL_BACKTRACK_MS = 1000
const PUSH_DEBOUNCE_MS = 2000
/** 队列上限：单表 1000 / 总量 2000（SHELL-06 C-41；仅提示不阻断） */
const QUEUE_LIMIT_PER_TABLE = 1000
const QUEUE_LIMIT_TOTAL = 2000
// ---------------------------------------------------------------------------
// 错误文案（C-12 家族约束：仅三种前缀；禁拼接原始异常/URL）
// ---------------------------------------------------------------------------
const ERR_PULL_EXPIRED = '拉取失败：登录已过期，请重新登录'
const ERR_PULL_NETWORK = '拉取失败：网络错误'
const ERR_PULL_DATA = '拉取失败：数据异常'
const ERR_PUSH_EXPIRED = '推送失败：登录已过期，请重新登录'
const ERR_PUSH_NETWORK = '推送失败：网络错误'
const ERR_PUSH_DATA = '推送失败：数据异常'
const ERR_PUSH_UNCONFIRMED = '推送失败：部分数据未确认'
const ERR_SESSION_EXPIRED = '登录已过期，请重新登录'

/**
 * 请求游标回拉（DEF-SYNC-05 缺陷2 的窗口值）
 * @description 保持原游标的时区后缀与精度形态（服务端 RFC3339：`Z` 或 `±hh:mm`），
 *              避免把 `+08:00` 改写为 `Z` 而改变服务端的时间解析口径；
 *              不可解析或无时区后缀（服务端本地时间口径不明）时**原样返回** ⇒ 退化为修复前行为。
 */
const rewindIsoCursor = (at: string, deltaMs: number): string => {
    const ts = Date.parse(at)
    const suffix = /(Z|[+-]\d{2}:\d{2})$/.exec(at)?.[1]
    if (!at || !Number.isFinite(ts) || !suffix) return at
    const minutes =
        suffix === 'Z' ? 0 : Number(suffix.slice(1, 3)) * 60 + Number(suffix.slice(4, 6))
    const offsetMs = (suffix.startsWith('-') ? -1 : 1) * minutes * 60000
    const shifted = new Date(ts - deltaMs + offsetMs).toISOString()
    return `${/\.\d{1,3}(Z|[+-]\d{2}:\d{2})$/.test(at) ? shifted.slice(0, 23) : shifted.slice(0, 19)}${suffix}`
}

export class SyncService {
    /** 变更后 2s 防抖推送（同实体重复写合并为最新，见 data-sync-plan.md §4.2） */
    private pushTimer: ReturnType<typeof setTimeout> | null = null

    /** 网络类失败暂停截止时间（ms epoch；SHELL-06 C-38，网络类不写 item） */
    private pausedUntil = 0

    /** 条件退避定时器（仅有待推送/暂停项时存在；C-40 有界且可停） */
    private backfillTimer: ReturnType<typeof setTimeout> | null = null

    /** 退避定时当前间隔索引（成功/清空清零） */
    private backfillLevel = 0

    /**
     * 上轮拉取是否未取尽（DEF-6）
     * @description 续拉中途失败/中断 ⇒ true；仅当所有表均取尽（pending 清空）才复位 false。
     *              用于无脏队列时仍安排回传定时补拉（`scheduleBackfillTick`）。
     */
    private pullIncomplete = false

    /** 测试可注入 mock；生产不注入则每次动态取全局 requester（避免模块加载时序捕获到 emptyRequester） */
    private readonly injectedRequester: Requester | null

    /** 同步操作串行队列（pull/push 互斥，避免在途旧版 push 覆盖远程新版，见审查报告缺陷 3） */
    private opChain: Promise<unknown> = Promise.resolve()

    /** 拉取写入本地数据后的回调（装配层注入：通知视图刷新） */
    private dataChangedListener: (() => void) | null = null

    /** 会话失效回调（业务码 10041：凭证验证失败 → 装配层清 JWT 回登录页） */
    private sessionExpiredListener: (() => void) | null = null

    /** 续拉轮数上界（DEF-6 护栏 A；缺省 PULL_MAX_ROUNDS） */
    private readonly pullMaxRounds: number

    /** 续拉时间预算 ms（DEF-6 护栏 A；缺省 PULL_TIME_BUDGET_MS） */
    private readonly pullTimeBudgetMs: number

    constructor(requester?: Requester, options: SyncServiceOptions = {}) {
        this.injectedRequester = requester ?? null
        this.pullMaxRounds = options.pullMaxRounds ?? PULL_MAX_ROUNDS
        this.pullTimeBudgetMs = options.pullTimeBudgetMs ?? PULL_TIME_BUDGET_MS
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

    /**
     * 读回磁盘镜像新鲜度（T107b/C-60）：冷启动离线也有「数据截至 X」（AC8）
     * @description 仅在磁盘有记录时覆盖内存态；无记录（从未成功拉取）保持 `null`（AC9）
     */
    async restoreMirrorStatus(): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        const persisted = await loadMirrorStatus(userId)
        if (persisted) syncStatus.restoreMirrorStatus(persisted)
    }

    /** 落盘当前镜像新鲜度（直连 meta，不触发 markDirty，C-59） */
    private async persistMirrorStatus(userId: string): Promise<void> {
        const { mirrorPulledAt, mirrorTruncated } = syncStatus.get()
        await saveMirrorStatus(userId, { mirrorPulledAt, mirrorTruncated })
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
     * @description 注销反悔期内跳过（反悔期内不同步，见 data-sync-plan.md §6）；
     *              单运行边界，返回值供门判成败（C-08/C-10）
     */
    async start(): Promise<SyncRunResult> {
        return this.enqueue(() =>
            this.runFull(async () => {
                const userId = this.currentUserId()
                if (!userId) return
                // T107b：先读回磁盘镜像新鲜度 ⇒ 离线冷启动亦有「数据截至 X」（AC8）
                await this.restoreMirrorStatus()
                // 注销反悔期：deletionSchedules 有调度记录则跳过启动
                const schedule = await localDatabase.deletionSchedules.get(userId)
                if (schedule) return
                // SHELL-06 C-42/G6：启动先重置退避/暂停（含删除项），避免触顶使 start 恒失败
                this.resumeBackfillState()
                await syncTracker.resetFailed(userId)
                await this.pullAllInner()
                await this.pushAllInner()
            })
        )
    }

    /** 拉取全部同步表（每表 keyset 游标增量，LWW 冲突判定） */
    async pullAll(): Promise<SyncRunResult> {
        return this.enqueue(() => this.runFull(() => this.pullAllInner(), 'pull'))
    }

    /**
     * 单运行边界：beginRun → 阶段执行 → 必达 endRun（C-08：禁任何 return/throw 绕过结束）
     * @param inner 阶段主体（网络/业务错误已在阶段内捕获）
     * @param phase 运行入口阶段（意外异常时的归因阶段）
     */
    private async runFull(
        inner: () => Promise<void>,
        phase: SyncPhase = 'pull'
    ): Promise<SyncRunResult> {
        syncStatus.beginRun(phase)
        try {
            await inner()
        } catch (err) {
            // 不可达防御：阶段内已捕获网络/业务错误；此处兜底存储/加解密等意外异常，
            // 仍须结束运行（否则 syncing 永久 true —— DEF-SYNC-02 同族）；
            // 文案归因为「数据异常」（PM 裁定：不得复用“网络错误”以免误导排查）
            console.error('[sync] 同步运行未预期异常', err)
            syncStatus.noteRunError(phase, phase === 'pull' ? ERR_PULL_DATA : ERR_PUSH_DATA)
        }
        return await this.finishRun()
    }

    /** 运行结束：刷新待推送/失败计数一次并落定状态（C-11） */
    private async finishRun(): Promise<SyncRunResult> {
        const userId = this.currentUserId()
        if (!userId) return syncStatus.endRun({ pendingCount: 0, failedCount: 0 })
        return syncStatus.endRun({
            pendingCount: await syncTracker.countDirty(userId),
            failedCount: await syncTracker.countFailed(userId)
        })
    }

    /**
     * 拉取全部同步表（串行队列内执行）
     * @description DEF-6：单轮 `limit=PULL_LIMIT` 在 >200 行账号下会截断（最旧优先）⇒
     *              按服务端 `nextCursor/nextCursorId` **续拉至无更多数据**：
     *              终止判据只用 `items.length < PULL_LIMIT`（服务端 `Total` 是**本页条数**、
     *              非剩余总数，误用会漏拉/多拉，见 arch R2 / `sync.go:212`）。
     *              续拉游标复用 `rewindIsoCursor`（回拉时 `cursorId` 归零），且**仅在成功应用后推进**；
     *              以「原始页尾不前进」为兜底终止，避免服务端重复返回同页时死循环。
     *              护栏 A：每表 ≤`PULL_MAX_ROUNDS` 轮（=2000 行）或总预算 `PULL_TIME_BUDGET_MS`，
     *              先到者生效；触顶即截断（`markMirrorTruncated`，不推进 `mirrorPulledAt`）。
     *              任一续拉轮失败即中止（`pullIncomplete=true`，交由回传定时补拉）。
     */
    private async pullAllInner(): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        // 每表待拉游标：首轮为存储游标回拉窗口；后续轮为上一页末尾回拉窗口
        const pending = new Map<string, PullCursorState>()
        for (const config of SYNC_TABLES) {
            const cursor = await localDatabase.syncCursor.get(`${userId}:${config.table}`)
            const cursorAt = cursor?.lastPullAt ?? ''
            const windowAt = rewindIsoCursor(cursorAt, PULL_BACKTRACK_MS)
            pending.set(config.table, {
                // 回拉窗口（DEF-SYNC-05 缺陷2）：请求按瞬时回拉 Δ，靠 LWW 幂等重放补齐严格 `>` 漏拉的行
                updatedAt: windowAt,
                // 回拉改变时间点 ⇒ 边界时刻必须从最小 id 起（服务端 keyset `updated_at = c AND id > cursorId`），
                // 否则同一时刻较低 id 的行仍会被跳过；未回拉（含不可解析退化）时保持原 keyset 位置
                cursorId: windowAt === cursorAt ? (cursor?.lastPullId ?? '') : '',
                lastEndAt: '',
                lastEndId: ''
            })
        }
        const startedAtMs = Date.now()
        let rounds = 0
        let writtenCount = 0
        try {
            while (pending.size > 0) {
                // 护栏 A（DEF-6）：轮数/时间上界，先到者截断
                if (
                    rounds >= this.pullMaxRounds ||
                    Date.now() - startedAtMs >= this.pullTimeBudgetMs
                ) {
                    syncStatus.markMirrorTruncated()
                    break
                }
                rounds += 1
                const pullBody: Record<string, Record<string, unknown>> = {}
                for (const [table, cursor] of pending) {
                    pullBody[table] = {
                        updatedAt: cursor.updatedAt,
                        cursorId: cursor.cursorId,
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
                    this.pullIncomplete = true
                    const status = (err as { response?: { status?: number } })?.response?.status
                    if (status === 401 || status === 403) {
                        console.error('[sync] 拉取被拒绝：登录已过期（401/403）', status)
                        syncStatus.noteRunError('pull', ERR_PULL_EXPIRED)
                    } else {
                        console.error('[sync] 拉取请求失败（网络/HTTP 错误）', err)
                        syncStatus.noteRunError('pull', ERR_PULL_NETWORK)
                    }
                    return
                }
                // 归一化网络错误检测：requester 对断网/超时不 reject，而是 resolve 顶层携带字符串 code 的归一化响应，
                // 不识别会被当作"空数据成功"静默吞掉（见审查报告缺陷 1）
                const raw = response as { code?: unknown; data?: unknown } | undefined
                const data = raw?.data as
                    | { data?: unknown; serverTime?: string | number }
                    | undefined
                // 业务码 10041（用户凭证验证失败）：HTTP 可能仍为 200，须在归一化检测前识别
                if (this.isSessionExpiredCode((data as { code?: unknown })?.code)) {
                    this.pullIncomplete = true
                    console.error('[sync] 拉取被拒绝：用户凭证验证失败（10041）')
                    syncStatus.markCredentialFailure()
                    this.notifySessionExpired()
                    syncStatus.noteRunError('pull', ERR_SESSION_EXPIRED)
                    return
                }
                if (typeof raw?.code === 'string' || data?.data === null) {
                    this.pullIncomplete = true
                    console.error('[sync] 拉取归一化错误（断网/超时）', raw?.code)
                    syncStatus.noteRunError('pull', ERR_PULL_NETWORK)
                    return
                }
                this.calibrateServerTime(
                    Number((data as { serverTime?: string | number }).serverTime)
                )
                // 后端结构：response.data = { code, message, data: { data: { [table]: { items, total, nextCursor, nextCursorId } } }, serverTime }
                const inner = (data?.data as { data?: Record<string, PullTableResult> } | undefined)
                    ?.data
                const results = inner ?? {}
                for (const config of SYNC_TABLES) {
                    const cursor = pending.get(config.table)
                    if (!cursor) continue
                    const result = results[config.table]
                    if (!result?.items) {
                        pending.delete(config.table)
                        continue
                    }
                    writtenCount += await this.applyPullBatch(config, result)
                    // 续拉判定（arch R2）：**只用 `items.length < limit`** 判「无更多」
                    // （服务端 `Total = int64(len(items))` 是本页条数，非剩余总数）；
                    // 原始页尾不前进（服务端重复返回同页）也视为取尽，避免死循环。
                    const nextCursor = result.nextCursor ?? ''
                    const nextCursorId = result.nextCursorId ?? ''
                    const advanced =
                        nextCursor !== '' &&
                        (nextCursor !== cursor.lastEndAt || nextCursorId !== cursor.lastEndId)
                    if (result.items.length < PULL_LIMIT || !advanced) {
                        pending.delete(config.table)
                    } else {
                        // 续拉复用同一回拉窗口（回拉时 cursorId 归零）；游标仅在成功应用后推进
                        const rewound = rewindIsoCursor(nextCursor, PULL_BACKTRACK_MS)
                        pending.set(config.table, {
                            updatedAt: rewound,
                            cursorId: rewound === nextCursor ? nextCursorId : '',
                            lastEndAt: nextCursor,
                            lastEndId: nextCursorId
                        })
                    }
                }
            }
            if (pending.size === 0) {
                // 所有表均取尽 ⇒ 镜像完整（DEF-6/AC13b：仅此处推进 mirrorPulledAt）
                this.pullIncomplete = false
                syncStatus.markMirrorPulled()
            } else {
                // 触顶截断：不推进 mirrorPulledAt（护栏 B），交由回传定时补拉
                this.pullIncomplete = true
            }
            // T107b：完整/截断结果落盘 ⇒ 冷启动离线仍可读到（C-59：直连 meta 不入队）
            await this.persistMirrorStatus(userId)
        } finally {
            // 有实际写入（含续拉中途失败前已落库部分）→ 通知视图刷新（store 缓存绕过，需事件驱动重拉）
            if (writtenCount > 0) this.notifyDataChanged()
        }
    }

    /** 派发数据变化事件（防御无 window 环境） */
    private notifyDataChanged(): void {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nao-todo:data-changed'))
        }
        this.dataChangedListener?.()
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
        // ⚠️ DEF-SYNC-05 缺陷1：时间戳一律按 UTC ms **瞬时**比较（与上方 LWW 同源）——
        //    远程 `updatedAt` 可能带 `+08:00` / `Z` 等不同后缀，字典序会把「字面量更大但瞬时更早」
        //    的值误判为更晚，导致游标错位（跳过未应用行或整段重放）。
        const cursorId = `${userId}:${config.table}`
        const existing = await localDatabase.syncCursor.get(cursorId)
        let lastPullAt = existing?.lastPullAt ?? ''
        let lastPullTs = Date.parse(lastPullAt) || 0
        for (const res of records) {
            const ts = String((res as { updatedAt?: string }).updatedAt ?? '')
            const parsed = Date.parse(ts) || 0
            if (ts && parsed > lastPullTs) {
                lastPullAt = ts
                lastPullTs = parsed
            }
        }
        // 服务端游标（指向同一 keyset 位置）瞬时不早于本批最大值时采用之：
        // 同时取回 nextCursorId 以对齐 (updatedAt, id) 二元组，避免边界行每轮重放
        const nextCursor = result.nextCursor ?? ''
        const nextCursorTs = Date.parse(nextCursor) || 0
        const useNextCursor = nextCursor !== '' && nextCursorTs >= lastPullTs
        await localDatabase.syncCursor.put({
            id: cursorId,
            userId,
            table: config.table,
            lastPullAt: useNextCursor ? nextCursor : lastPullAt,
            lastPullId: useNextCursor ? (result.nextCursorId ?? '') : '',
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
    async pushAll(): Promise<SyncRunResult> {
        return this.enqueue(() => this.runFull(() => this.pushAllInner(), 'push'))
    }

    /** 推送脏队列（串行队列内执行） */
    private async pushAllInner(): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        const queue = await syncTracker.listDirty(userId)
        try {
            if (queue.length === 0) return
            const nowMs = Date.now()
            // SHELL-06 C-38/C-39：网络暂停期不发起；退避未到期项跳过（旧记录无 nextAttemptAt 视为可推）
            const dueQueue =
                this.pausedUntil > nowMs ? [] : queue.filter((item) => isRetryDue(item, nowMs))
            if (dueQueue.length === 0) return

            const pushBody: Record<string, Record<string, unknown>[]> = {}
            const deletions: { table: string; id: string }[] = []
            // 发送前快照各实体 localUpdatedAt：确认后仅当队列项未被推送期间的新修改覆盖才移除，
            // 否则保留下轮重推，避免本地修改被误删丢失（见审查报告缺陷 2）
            const snapshots = new Map<string, string>()
            for (const item of dueQueue) {
                const config = SYNC_TABLES.find((c) => c.table === item.table)
                if (!config) {
                    // 不可达防御（与写队列同常量源）：仅诊断，归因并入本阶段同一错误上报（见 ADR A-3）
                    console.error('[sync] 推送队列项缺少表配置', item.table)
                    continue
                }
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
            if (Object.keys(pushBody).length === 0 && deletions.length === 0) {
                // 到期项均缺表配置（不可达防御）：必须上报运行错误，否则 syncing 卡死且门读到 null ⇒ 假成功
                syncStatus.noteRunError('push', ERR_PUSH_DATA)
                return
            }

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
                // SHELL-06 C-38：三分类 —— 凭证（401/403）维持会话失效；网络类暂停不计数；其余业务退避
                const status = (err as { response?: { status?: number } })?.response?.status
                const errorClass = classifyPushFailure({ httpStatus: status })
                if (errorClass === 'credential') {
                    console.error('[sync] 推送被拒绝：登录已过期（401/403）', status)
                    syncStatus.noteRunError('push', ERR_PUSH_EXPIRED)
                } else if (errorClass === 'network') {
                    console.error('[sync] 推送请求失败（网络/HTTP 错误）', err)
                    this.pauseForNetworkFailure()
                    syncStatus.noteRunError('push', ERR_PUSH_NETWORK)
                } else {
                    console.error('[sync] 推送请求失败（业务/数据错误）', err)
                    for (const item of dueQueue) {
                        if (snapshots.has(`${item.table}:${item.entityId}`)) {
                            await syncTracker.markBusinessFailure(
                                item.id,
                                this.businessNextAttemptAt(item)
                            )
                        }
                    }
                    syncStatus.noteRunError('push', ERR_PUSH_DATA)
                }
                return
            }
            // 归一化网络错误检测（断网/超时 resolve 场景，见审查报告缺陷 1）
            const raw = response as { code?: unknown; data?: unknown }
            // 业务码 10041（用户凭证验证失败）：HTTP 可能仍为 200，须在归一化检测前识别
            const dataRaw = raw?.data as { code?: unknown } | undefined
            if (this.isSessionExpiredCode(dataRaw?.code)) {
                console.error('[sync] 推送被拒绝：用户凭证验证失败（10041）')
                syncStatus.markCredentialFailure()
                this.notifySessionExpired()
                syncStatus.noteRunError('push', ERR_SESSION_EXPIRED)
                return
            }
            if (typeof raw?.code === 'string') {
                // C-38：归一化断网/超时 ⇒ 暂停，不消耗重试额度（不 markFailed）
                console.error('[sync] 推送归一化错误（断网/超时）', raw?.code)
                this.pauseForNetworkFailure()
                syncStatus.noteRunError('push', ERR_PUSH_NETWORK)
                return
            }
            const data =
                (raw?.data as { data?: { results?: PushResult[] }; serverTime?: number }) ?? {}
            console.log('[sync] 推送响应', JSON.stringify(response?.data))
            this.calibrateServerTime((data as { serverTime?: number }).serverTime)
            const results = data.data?.results ?? []
            const pushed = new Set(results.map((r) => `${r.table}:${r.id}`))
            let unconfirmed = false
            for (const item of dueQueue) {
                if (pushed.has(`${item.table}:${item.entityId}`)) {
                    const snapshot = snapshots.get(`${item.table}:${item.entityId}`)
                    // 推送期间本地对同一实体有新修改（localUpdatedAt 已变化）：保留队列项下轮重推，防止本地修改丢失
                    const current = await localDatabase.syncQueue.get(item.id)
                    if (current && snapshot !== undefined && current.localUpdatedAt === snapshot) {
                        await syncTracker.removeQueued(item.table, item.entityId)
                    }
                } else {
                    // 响应中无该实体：后端拒绝或字段不匹配 ⇒ 业务类退避（C-38/C-39）
                    if (snapshots.has(`${item.table}:${item.entityId}`)) {
                        console.warn('[sync] 推送未确认的实体', {
                            table: item.table,
                            id: item.entityId
                        })
                        await syncTracker.markBusinessFailure(
                            item.id,
                            this.businessNextAttemptAt(item)
                        )
                        unconfirmed = true
                    }
                }
            }
            // 部分数据未确认 ⇒ 运行失败（否则门会假成功）；同阶段同类错误只上报一次（见 ADR A-2）
            if (unconfirmed) syncStatus.noteRunError('push', ERR_PUSH_UNCONFIRMED)
            // 全部确认 ⇒ 回传完成：清暂停与退避定时（C-40 成功即停）
            if (!unconfirmed) {
                this.resumeBackfillState()
                this.clearBackfillTick()
            }
        } finally {
            // C-41 上限可见性（仅提示不阻断）+ C-40 条件退避定时（按需启停）
            await this.refreshQueuePressure()
            await this.scheduleBackfillTick()
        }
    }

    /** 网络类失败：服务级暂停（不写 item、不累加计数；C-38） */
    private pauseForNetworkFailure(): void {
        this.pausedUntil = Date.now() + backoffDelayMs(1)
        syncStatus.setPaused('offline')
    }

    /** 业务/数据类退避时间（基于队列项既有 attempts；指数封顶 120s，C-39） */
    private businessNextAttemptAt(item: SyncQueueRecord): string {
        const attempts = (item.attempts ?? item.retryCount ?? 0) + 1
        return new Date(Date.now() + backoffDelayMs(attempts)).toISOString()
    }

    /** 变更后 2s 防抖推送 */
    schedulePush(): void {
        if (this.pushTimer) clearTimeout(this.pushTimer)
        this.pushTimer = setTimeout(() => {
            this.pushTimer = null
            void this.pushAll()
        }, PUSH_DEBOUNCE_MS)
    }

    /** 手动完整同步（拉取全部 + 推送全部，供 UI 触发；先重置退避/暂停 C-42） */
    async manualSync(): Promise<SyncRunResult> {
        return this.enqueue(() =>
            this.runFull(async () => {
                const userId = this.currentUserId()
                if (userId) {
                    this.resumeBackfillState()
                    await syncTracker.resetFailed(userId)
                }
                await this.pullAllInner()
                await this.pushAllInner()
            })
        )
    }

    /* —— SHELL-06 C-40：回传触发源与条件退避 —— */

    /**
     * 清暂停并重置退避进度（仅内存态；队列项重置由 `resetFailed` 负责）
     */
    private resumeBackfillState(): void {
        this.pausedUntil = 0
        this.backfillLevel = 0
        syncStatus.clearPaused()
    }

    /**
     * 恢复回传（网络恢复/前台恢复/手动）：清暂停 + 重置退避 + 经 enqueue 先拉后推
     * @description C-43：`online`/可见性仅作触发，不得作鉴权/放行；C-40：均经 enqueue 串行。
     *              DEF-6：旧实现只 push 不 pull ⇒ 大账号在无脏队列时永远补不全本地镜像；
     *              故与 `start()`/`manualSync()` 同口径，先 `pullAllInner()` 再 `pushAllInner()`。
     */
    async resumeBackfill(): Promise<SyncRunResult> {
        const userId = this.currentUserId()
        if (userId) {
            this.resumeBackfillState()
            await syncTracker.resetFailed(userId)
        }
        const result = await this.enqueue(() =>
            this.runFull(async () => {
                await this.pullAllInner()
                await this.pushAllInner()
            })
        )
        await this.scheduleBackfillTick()
        return result
    }

    /** `online` 事件触发（仅触发，不作鉴权，C-43） */
    handleOnline(): void {
        void this.resumeBackfill()
    }

    /** 前台恢复（`visibilitychange→visible`）触发（节流由 scheduleBackfillTick 统一收敛） */
    handleVisibility(): void {
        void this.resumeBackfill()
    }

    /**
     * 按需启动条件退避定时（C-40 / SHELL-06-DEF-01）
     * @description 暂停期**不得 return**：按 `pausedUntil` 到期安排 tick（clamp ≤120s），
     *              到期自动 `resumeBackfill`；业务退避按最早 `nextAttemptAt` 唤醒；
     *              有到期项时按指数间隔；**拉取未取尽（DEF-6）时也不得跳过补拉**；
     *              无待推送/暂停/待补拉项时不创建（有界且可停）。
     *              单一定时器：调用即先清旧（可重排，不叠加/泄漏）。
     */
    private async scheduleBackfillTick(): Promise<void> {
        this.clearBackfillTick()
        const userId = this.currentUserId()
        if (!userId) return
        const nowMs = Date.now()
        const pending = await syncTracker.countDirty(userId)
        // DEF-6：`countDirty === 0` 不得直接 return —— 拉取未取尽仍需安排补拉 tick
        if (pending === 0 && !this.pullIncomplete) {
            this.backfillLevel = 0
            return
        }
        const due = await syncTracker.countDue(userId, nowMs)
        const earliest = await syncTracker.earliestNextAttemptAt(userId)
        const delay = computeBackfillDelayMs({
            nowMs,
            pausedUntilMs: this.pausedUntil,
            dueCount: due,
            earliestNextAttemptAtMs: earliest,
            level: this.backfillLevel,
            pullPending: this.pullIncomplete
        })
        if (delay === null) return
        if (this.pausedUntil <= nowMs && due > 0) {
            this.backfillLevel = Math.min(this.backfillLevel + 1, 5)
        }
        this.backfillTimer = setTimeout(() => {
            this.backfillTimer = null
            void this.resumeBackfill()
        }, delay)
    }

    /** 停止条件退避定时（成功/清空/卸载调用） */
    private clearBackfillTick(): void {
        if (this.backfillTimer) clearTimeout(this.backfillTimer)
        this.backfillTimer = null
    }

    /**
     * 刷新队列压力（C-41 上限可见性）：超限仅提示不阻断
     */
    private async refreshQueuePressure(): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        const counts = await syncTracker.countByTable(userId)
        const overLimit = isQueueOverLimit(
            counts.values(),
            QUEUE_LIMIT_PER_TABLE,
            QUEUE_LIMIT_TOTAL
        )
        if (overLimit) syncStatus.setPaused('over-limit')
        else if (this.pausedUntil <= Date.now()) syncStatus.clearPaused()
    }
}

/** 同步服务单例 */
export const syncService = new SyncService()