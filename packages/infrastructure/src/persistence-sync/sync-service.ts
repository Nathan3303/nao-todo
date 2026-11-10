/**
 * 数据同步服务
 * @description 编排拉取/推送/冲突（LWW）/游标/重试/时机；唯一与网络打交道的同步模块。
 *              批量接口 POST /sync/pull 与 POST /sync/push（后端已落地，
 *              见 data-sync-plan-backend-implementation.md 阶段 C）。
 *              拉取写入直连表 + converters（不触发 markDirty，避免同步回环）。
 */
import { getRequesterImpl, type Requester } from '@nao-todo/shared/requester'
import { buildAuthHeaders } from '@nao-todo/shared/requester/auth-headers'
import {
    consumeRotationGrace,
    extractBearerToken,
    isStaleTokenSnapshot
} from '@nao-todo/shared/requester/auth-rotation'
import { isCheckInInFlight } from '@nao-todo/shared/requester/checkin-window'
import { RATE_LIMIT_ERROR_MESSAGE } from '@nao-todo/shared/requester/network-error-messages'
import { decideSessionEnd } from '@nao-todo/domain-identity'
import type { Table } from 'dexie'
import { pickUnexpectedDroppedFields } from './dropped-fields'
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
import { toLocalProjectId, toPushProjectId, syncPayloadMatchesServer } from './sync-normalize'
import { loadMirrorStatus, saveMirrorStatus } from './mirror-status-store'
import { appendConflict, countConflicts, valuesEqual } from './conflict-journal'
import { pickChangedFields } from './edit-overwrite'
import {
    isMergeDomainField,
    mergeBusinessFields,
    resolveMergeMode,
    type MergeWinner
} from './field-merge'
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
import { logStructured, STRUCTURED_LOG_EVENTS } from '../observability/structured-log'
import { createPullBroadcast } from './pull-broadcast'

// ---------------------------------------------------------------------------
// 同步表配置（7 张业务表；⚠️ 偏好 **不随父实体同步**（旧注释不实，TASK-26/ADR-r2 P2 更正）：
// projectPreferences 走独立偏好队列按行回传、内建偏好/设置面走 `UserConfig.preferences` 快照，均不入本表；
// users/userConfigs 走远程用户域，均不入同步）
// ---------------------------------------------------------------------------

export interface SyncTableConfig {
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
 * 收集箱本地哨兵（单一口径：数据面一律字面 `'inbox'`；ADR `2026-09-24-project-archive.md` §15.1 / Q4）
 * @description 服务端隐式桶以 `userId` 承载（create/update 对 `''` 归一为 `userId`）。
 *              R-5 闭环（T188）在**同步边界**做对称映射：写侧 `'inbox'` → `''`、读侧 `userId` → `'inbox'`；
 *              两端**唯一落点**分别为 `buildTaskPush` / `putPulledRecord`（⛔ 勿在调用点散落映射）。
 *              ⚠️ 实现已下沉到 `./sync-normalize`，供 pull 与「保留服务端」写回（DEF-132）**共用同一链**。
 */

/**
 * 构建任务推送记录
 * @description `sortId = 0` 表示未设置（服务端分配）⇒ 不产出该字段，
 *              否则存量本地记录的 0 会在服务端覆盖分支把组内序清零（ADR B1 / G4）。
 *              R-5 / T188-C：收集箱 `'inbox'` 发送为 `''`（服务端 create 路径对 `'inbox'`
 *              报错且不归一 ⇒ 载荷构造处一处生效，覆盖全部 `'inbox'` 写者）。
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
    record.projectId = toPushProjectId(record.projectId)
    return record
}

/**
 * 业务同步表配置（**单一事实源**；`conflict-entity-registry` 一致性测试直接 import 本表）
 * @description 导出供 `__tests__/conflict-entity-registry.test.ts` 做集合级断言，
 *              消除对 `sync-service.ts` 源码的文本扫描耦合。
 */
export const SYNC_TABLES: SyncTableConfig[] = [
    {
        table: 'projects',
        resToEntity: projectRes2Entity as unknown as SyncTableConfig['resToEntity'],
        entityToRecord: projectEntityToRecord as unknown as SyncTableConfig['entityToRecord'],
        recordToEntity: projectRecordToEntity as unknown as SyncTableConfig['recordToEntity'],
        entityToPush: buildPush([
            'name',
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
    /** 服务端判定（T143 additive + 2B `stale`）：`applied`/`noop`/`stale`/`conflict`/`skipped`/`error` */
    outcome?: string
    /** 载荷含、服务端 sync DTO 不承载的 JSON 键（T466 additive；空时服务端省略该键） */
    droppedFields?: string[]
    /**
     * 服务端当前行（T643 / A2 additive；sync 条目形状）
     * @description 仅 `stale`（含删除 stale）返回；供「保留服务端」离线写回 + F-09 判等。
     *              旧服务端缺省 ⇒ 客户端走「待下次同步生效」两态（不得假装成功）。
     */
    serverCurrent?: Record<string, unknown>
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
 * pull 单主锁名前缀（C-66 / AC16a 代偿）
 * @description 同 origin 多标签并发 pull 会使 `syncCursor` RMW / `syncQueue` 单写者假设失效；
 *              锁名按 `userId` 隔离（不同账号互不阻塞）。desktop 单实例锁下恒无争用 ⇒ 行为等价。
 */
const PULL_LOCK_PREFIX = 'nao-todo:pull:'
/**
 * push 单主锁名前缀（ADR §9.3 / R-3）
 * @description 同 origin 多标签并发 push 会使 `syncQueue` 单写者假设失效，且 push 临界区内含
 *              journal 写入（`appendConflict` 对 `meta` 单记录 RMW）⇒ 需跨标签选主；
 *              锁名按 `userId` 隔离（不同账号互不阻塞）。desktop 单实例锁下恒无争用 ⇒ 行为等价。
 */
const PUSH_LOCK_PREFIX = 'nao-todo:push:'
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
/**
 * 待推送数补充落定防抖（DEF-13）
 * @description 入队（`markDirty`）后界面数字滞后到下一次运行结束才更新 ⇒ 在**入队侧事件**上
 *              防抖重读队列并落定；连续入队只刷新一次。
 */
const PENDING_COUNT_SETTLE_DEBOUNCE_MS = 400
/** 队列上限：单表 1000 / 总量 2000（SHELL-06 C-41；仅提示不阻断） */
const QUEUE_LIMIT_PER_TABLE = 1000
const QUEUE_LIMIT_TOTAL = 2000
/**
 * 事件触发拉取的合并门（T654 / R-9 / AC5b）
 * @description 距上次**成功**拉取 <10s ⇒ 本次事件触发（回可见 / `online`）**只推不拉**，
 *              防 alt-tab / Wi-Fi 抖动把请求数放大；手动「立即同步」与周期拉取**不过门**。
 */
const EVENT_PULL_MERGE_GATE_MS = 10_000

/**
 * `/sync/pull` 成功业务码**白名单**（T657 / DEF-140）
 * @description 服务端成功码实测为 `90020`。⛔ **不得**改用「非 0 即成功」：
 *              限流 / 拒绝类业务码（`10051` 限流、`90022`）走 **HTTP 200 + 业务码 + 无 `data`**，
 *              按「非 0 即成功」会被当成空拉取（假绿）。白名单可能有多值，故用集合。
 */
const PULL_SUCCESS_CODES: readonly unknown[] = [90020]

/** 限流业务码（已知：`10051`；与 `apps/web/.../search-tasks.ts` 的限流识别同源含义） */
const PULL_RATE_LIMIT_CODES: readonly unknown[] = [10051]
// ---------------------------------------------------------------------------
// 错误文案（C-12 家族约束：仅三种前缀；禁拼接原始异常/URL）
// ---------------------------------------------------------------------------
const ERR_PULL_EXPIRED = '拉取失败：登录已过期，请重新登录'
const ERR_PULL_NETWORK = '拉取失败：网络错误'
const ERR_PULL_DATA = '拉取失败：数据异常'
/** 限流（10051）专用文案：复用 requester 的既有用户文案，不说内部术语（T657） */
const ERR_PULL_RATE_LIMITED = `拉取失败：${RATE_LIMIT_ERROR_MESSAGE}`
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

    /** 待推送数补充落定防抖定时器（DEF-13；**非运行边界**，只读本地队列） */
    private pendingCountTimer: ReturnType<typeof setTimeout> | null = null

    /** 网络类失败暂停截止时间（ms epoch；SHELL-06 C-38，网络类不写 item） */
    private pausedUntil = 0

    /** 条件退避定时器（仅有待推送/暂停项时存在；C-40 有界且可停） */
    private backfillTimer: ReturnType<typeof setTimeout> | null = null

    /** 退避定时当前间隔索引（成功/清空清零） */
    private backfillLevel = 0

    /**
     * 上次**成功**拉取完成时间（ms epoch；T654 / R-9 合并门判据）
     * @description 仅「请求成功且已应用」推进（失败/凭证失效/早退不推进）⇒ 事件触发据此判可否合并。
     *              ⛔ 界面新鲜度判据仍只看 `syncStatus.mirrorPulledAt` / `lastSyncAt`（R-7）。
     */
    private lastPullSucceededAt: number | null = null

    /**
     * 跨标签「拉取完成」广播（T654 / R-6 / AC7；无 `BroadcastChannel` 环境自动 no-op）
     * @description 每实例独立频道：拉取成功后广播，非主标签据此 refresh 视图（不发网络）。
     */
    private readonly pullBroadcast = createPullBroadcast()

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

    /**
     * 上次**成功**拉取完成时间（ms epoch；从未成功为 null）
     * @description T654 / R-9：供事件触发合并门与自动刷新层/测试读取。
     *              ⛔ **不得**作为界面「是否最新」的判据（R-7：只看 `syncStatus.mirrorPulledAt`）。
     */
    getLastSuccessfulPullAt(): number | null {
        return this.lastPullSucceededAt
    }

    /**
     * 他标签已拉取完成（广播命中；T654 / R-6 / AC7）
     * @description 非主标签收到主标签的「已拉取」通知后调用：**只刷新本窗口视图**
     *              （数据已由主标签落入**同一** IndexedDB，不得再发一次网络）。
     *              同时把合并门时间收敛到主标签的完成时间，避免多标签重复拉取。
     * @returns 新鲜度收敛的完成信号（T659）；调用方可不等待（视图刷新是同步的）
     */
    applyForeignPullComplete(at: number = Date.now()): Promise<void> {
        this.lastPullSucceededAt = Math.max(this.lastPullSucceededAt ?? 0, at)
        this.notifyDataChanged()
        // T659 / DEF-142：R-7 要求「是否最新」只看 `mirrorPulledAt`；数据已新而面板时间定格
        //   = 两处判据不一致（用户惑）。收敛取**同一份**持久化事实，不新建真源、不发网络。
        return this.convergeMirrorFreshness(at)
    }

    /**
     * 镜像新鲜度收敛（T659 / DEF-142 / R-7）
     * @description 主标签已在 `persistMirrorStatus` 落盘**且先落盘再广播** ⇒ 这里重读同一 IndexedDB 的
     *              `meta`（不新增真源）。规则：
     *              - `mirrorPulledAt` 只前进不后退（取 max: 当前 / 持久化 / 广播时间）；
     *              - `mirrorTruncated` **只取持久化事实**，⛔ 绝不因「广播说某时刻拉取成功」而清掉 ——
     *                截断未补齐 ≠ 已完整（否则等于绕过 DEF-6 续拉判据，把「不够」假绿成「完整」）。
     *              读不到持久化记录（极端）⇒ 只推进时间戳，truncation 保持原值。
     */
    private async convergeMirrorFreshness(at: number): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        try {
            const persisted = await loadMirrorStatus(userId)
            const current = syncStatus.get()
            const previous = [current.mirrorPulledAt, persisted?.mirrorPulledAt ?? null]
                .filter((value): value is string => typeof value === 'string' && value !== '')
                .map((value) => Date.parse(value))
                .filter((value) => Number.isFinite(value))
            const broadcastAt = Number.isFinite(at) ? at : Date.now()
            syncStatus.restoreMirrorStatus({
                mirrorPulledAt: new Date(Math.max(broadcastAt, ...previous)).toISOString(),
                mirrorTruncated: persisted ? persisted.mirrorTruncated : current.mirrorTruncated
            })
        } catch {
            // 本地读失败：保持原值（不比修复前更差），且不得影响已完成的视图刷新
        }
    }

    /** 判定业务码是否为会话失效（D1 单一判据：被动投影仅凭证类 ⇒ 结束；纳入 `10042`） */
    private isSessionExpiredCode(code: unknown): boolean {
        return decideSessionEnd({ source: 'passive', code: code as string | number })
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
            // D6：无 token ⇒ `{}`（**永不** `Bearer null`）；拼接只在 shared 单点实现
            return buildAuthHeaders(getJWTFromLocalStorage())
        } catch {
            // 无 localStorage 环境（测试）：不带鉴权头
            return {}
        }
    }

    /**
     * 会话是否已结束（D6 「sessionEnded 门」）
     * @description 可读到 token 源且拿不到 token ⇒ 会话已结束（登出/失效后 JWT 已被清）；
     *              token 源本身不可读（无 localStorage 的运行时）⇒ 无法判定，**不**据此拦截。
     */
    private hasEndedSession(): boolean {
        try {
            return getJWTFromLocalStorage() === null
        } catch {
            return false
        }
    }

    /**
     * 10041 是否属于「陈旧请求」（T558：发出时 token 快照 ≠ 当前 token / `Bearer null`）
     * @description 陈旧响应**只记录**：不清凭证、不导航、不置失效态；真实失效才走后续处置。
     * @param headers 该请求发出时的鉴权头
     */
    private isStaleCredentialResponse(headers: Record<string, string>): boolean {
        // 未带 Bearer 头 ⇒ 按空快照处理（无凭据的请求不可能代表当前会话失效）
        const requestToken = extractBearerToken(headers.Authorization) ?? ''
        let currentToken: string | null = null
        try {
            currentToken = getJWTFromLocalStorage()
        } catch {
            currentToken = null
        }
        return isStaleTokenSnapshot(requestToken, currentToken)
    }

    /**
     * 处置 sync 的 10041：陈旧快照 / 轮换宽限内 ⇒ 仅结构化记录（T558）
     * @description 优先级：① 陈旧响应 → ② 轮换宽限（Web 端从不 `markTokenRotated` ⇒ 恒不命中，行为零变化）
     *              → ③ **检入在途**（T558 R1：检入换发期间的在途请求必然拿 10041，由检入结果裁决）。
     * @param headers 该请求发出时的鉴权头（token 快照）
     * @param phase 'pull' | 'push'
     * @param userId 当前用户
     * @returns `true` = 已按「陈旧/宽限/检入在途」处置（调用方**直接 return**，不做后续失效动作）
     */
    private skipStaleCredentialFailure(
        headers: Record<string, string>,
        phase: 'pull' | 'push',
        userId: string
    ): boolean {
        const stale = this.isStaleCredentialResponse(headers)
        const checkInInFlight = isCheckInInFlight()
        if (!stale && !checkInInFlight && !consumeRotationGrace()) return false
        const requestToken = extractBearerToken(headers.Authorization)
        logStructured(
            'warn',
            phase === 'pull'
                ? STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED
                : STRUCTURED_LOG_EVENTS.SYNC_PUSH_FAILED,
            {
                userId,
                phase,
                kind: stale
                    ? 'stale-credential'
                    : checkInInFlight
                      ? 'checkin-in-flight'
                      : 'rotation-grace',
                snapshot: requestToken ? `${requestToken.slice(0, 8)}…` : null
            }
        )
        return true
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

    /**
     * 从磁盘恢复冲突记账条数（PS-14 / DP-1；冷启动状态面计数）
     * @description 同 `restoreMirrorStatus`：内存态冷启动归零 ⇒ 启动时以磁盘事实覆盖。
     */
    async restoreConflictCount(): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        syncStatus.setConflictCount(await countConflicts(userId))
    }

    /** 落盘当前镜像新鲜度（直连 meta，不触发 markDirty，C-59） */
    private async persistMirrorStatus(userId: string): Promise<void> {
        const { mirrorPulledAt, mirrorTruncated } = syncStatus.get()
        await saveMirrorStatus(userId, { mirrorPulledAt, mirrorTruncated })
    }

    /** 校准服务器时间偏移（响应带回 serverTime，UTC Unix 毫秒；后端可能返回字符串） */
    private calibrateServerTime(serverTime?: number | string): void {
        const value = typeof serverTime === 'string' ? Number(serverTime) : serverTime
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            setServerTimeOffset(value - Date.now())
        }
    }

    /** 按表名取 Dexie 表（类型收窄辅助） */
    private tableOf(config: SyncTableConfig): {
        put: (record: unknown) => Promise<unknown>
        get: (id: string) => Promise<Record<string, unknown> | undefined>
        update: (id: string, changes: Record<string, unknown>) => Promise<unknown>
    } {
        return localDatabase[config.table as keyof typeof localDatabase] as never
    }

    /** 原始 Dexie 表（供事务作用域使用；`tableOf` 的窄接口无法参与 `transaction`） */
    private rawTableOf(config: SyncTableConfig): Table<Record<string, unknown>, string> {
        return localDatabase[config.table as keyof typeof localDatabase] as unknown as Table<
            Record<string, unknown>,
            string
        >
    }

    /**
     * 构造拉取行记录（含 per-row base），**加解密在事务外**完成
     * @description 供 `putPulledRecord` 与「队列再确认 + 写入」事务共用（Dexie 事务内不得 await 外部长 Promise）。
     */
    private async buildPulledRecord(
        config: SyncTableConfig,
        entity: Record<string, unknown>,
        userId: string
    ): Promise<Record<string, unknown>> {
        // R-5 / T188-B：拉取落库边界把服务端隐式桶（`projectId === userId`）归一为本地字面 `'inbox'`
        const source =
            config.table === 'tasks'
                ? { ...entity, projectId: toLocalProjectId(entity.projectId, userId) }
                : entity
        const record = (await config.entityToRecord(source, userId)) as {
            syncedServerUpdatedAt?: string
            icon?: unknown
        }
        // A6（F-06）：`icon` 已移出同步契约（服务端无列 / 无 DTO）⇒ 拉取**不得**用默认值覆盖本地图标
        //（本地图标 = 「仅本机」字段；无旧行时用 converter 的本地默认值）
        if (config.table === 'projects' || config.table === 'tags') {
            const existing = (await this.tableOf(config).get(String(entity.id))) as
                | { icon?: unknown }
                | undefined
            if (typeof existing?.icon === 'string' && existing.icon !== '') {
                record.icon = existing.icon
            }
        }
        const serverUpdatedAt = typeof entity.updatedAt === 'string' ? entity.updatedAt : ''
        if (serverUpdatedAt) record.syncedServerUpdatedAt = serverUpdatedAt
        return record as Record<string, unknown>
    }

    /**
     * 落库一条拉取记录，并同时落 per-row 同步版本基线
     * @description §9.1.5 / R-20：pull 写入时 `syncedServerUpdatedAt` = 该行服务端 `updatedAt`，
     *              作为下轮 push 的 `baseUpdatedAt`。直连表写入，不触发 markDirty。
     */
    private async putPulledRecord(
        config: SyncTableConfig,
        entity: Record<string, unknown>,
        userId: string
    ): Promise<void> {
        await this.tableOf(config).put(await this.buildPulledRecord(config, entity, userId))
    }

    /**
     * 以服务端回执版本写回该行 per-row base（§9.1.6 写回点）
     * @description `applied`/`noop`/`stale` 回执均带 `serverUpdatedAt`；`stale` 时即为库中当前版本，
     *              写回后使下次 push 以新 base 命中。仅更新 base 字段（不改业务字段/不触发 markDirty）。
     */
    private async writeBackSyncBase(
        table: string,
        entityId: string,
        serverUpdatedAt: string
    ): Promise<void> {
        const config = SYNC_TABLES.find((c) => c.table === table)
        if (!config) return
        await this.tableOf(config).update(entityId, {
            syncedServerUpdatedAt: serverUpdatedAt
        })
    }

    /**
     * A1（F-01）拉取「本地胜」记账
     * @description 触发判据（三者同时）：`queued` 存在 · `remoteTs <= localTs` · 逐字段 diff 非空
     *              （排除 `updatedAt/syncedServerUpdatedAt/revision`）。loser = **远端快照**
     *              （将被本地覆盖的那一版），**只存 diff 字段 + 身份字段**（R-H：禁整行复制）。
     *              去重由 `appendConflict` 按 `(table, entityId, kind, winnerUpdatedAt)` 完成。
     *              ⛔ 墓碑特例不在本方法内（调用方已分流到「远端胜」，否则会确定性复活）。
     */
    private async recordPullLocalWins(
        config: SyncTableConfig,
        remote: Record<string, unknown>,
        entityId: string,
        localUpdatedAt: string,
        userId: string
    ): Promise<void> {
        const remoteUpdatedAt = typeof remote.updatedAt === 'string' ? remote.updatedAt : ''
        if (!remoteUpdatedAt) return
        const localRecord = await this.tableOf(config).get(entityId)
        if (!localRecord) return
        const local = await config.recordToEntity(localRecord)
        const loser: Record<string, unknown> = { id: entityId }
        // DEF-135 / T669：判等与「挑差异字段」的唯一口径（空值哨兵归一 + 忽略集单一来源）
        //   ⇒ 与保存侧（`edit-overwrite.pickOverwrittenFields`）共用同一 helper，⛔ 禁第二套
        const diffFields = pickChangedFields(remote, local as unknown as Record<string, unknown>)
        // 逐字段 diff 为空 ⇒ 不是一次「会丢数据的裁决」⇒ 不记账
        if (diffFields.length === 0) return
        for (const field of diffFields) {
            loser[field] = remote[field] === undefined ? null : remote[field]
        }
        const count = await appendConflict(userId, {
            kind: 'pull-local-wins',
            table: config.table,
            entityId,
            loser,
            winnerUpdatedAt: localUpdatedAt,
            loserUpdatedAt: remoteUpdatedAt
        })
        syncStatus.setConflictCount(count)
    }

    /**
     * T679 / M3：pull 侧字段级合并（`tasks` × `upsert` × 有字段级基准）
     *
     * @description 三条集成守卫（ADR §实施口径补充 / M2 复核）：
     *              ① `fields` = **完整合并域**（`entityToPush` 键集）—— ⛔ 不传「差异字段子集」（否则
     *                 提醒组整组快照与冲突字段集合残缺）；
     *              ② 落库 = `{ ...localRecord, ...mergedFiltered }` + **base 单独推进**（不回退）+ `deletedAt`
     *                 从本地行保留（R-4）—— ⛔ 不得整行 replace；
     *              ③ `merged` 的显式 `undefined` **必须过滤**（否则 spread 会清空本地值）。
     *
     *              基准补齐：`fieldBase` 只含「我改过的字段」⇒ 缺失字段的 `B` = **本地当前值**
     *              （= 我未改）⇒ 取远端值；整份 `fieldBase` 缺失时调用方根本不会进本方法（走今日分支）。
     *              失败语义（AC3）：行 + 基准**同事务**落库，**落库成功后才记账**（不写半成品 / 不记假账）。
     *              记账 kind 沿用该边界既有 kind（远端胜 = `remote-wins`；本地胜 = `pull-local-wins`），
     *              ⛔ 本步不加 `conflictFields`（M5）。
     *
     * @returns `written` = 行是否有实际变更（业务字段或 base）；`keptLocalFields` = 合并结果是否仍有
     *          我方字段（远端胜支据此决定是否出队）；`conflicts` = 冲突字段（按合并域顺序）
     */
    private async applyPullFieldMerge(
        config: SyncTableConfig,
        remote: Record<string, unknown>,
        entityId: string,
        queued: SyncQueueRecord,
        localRecord: Record<string, unknown>,
        winner: MergeWinner,
        userId: string
    ): Promise<{ written: boolean; keptLocalFields: boolean; conflicts: string[] }> {
        const local = await config.recordToEntity(localRecord)
        // 形状对齐：`tasks.projectId` 的远端形态是服务端隐式桶（`userId`）⇒ 先归一为本地字面 `'inbox'`，
        // 否则「我未改」的字段会被判成差异（`valuesEqual('inbox', userId) === false`）而多写一次。
        const remoteEntity =
            config.table === 'tasks'
                ? { ...remote, projectId: toLocalProjectId(remote.projectId, userId) }
                : remote
        const fields = Object.keys(config.entityToPush(remoteEntity))
        const base = this.augmentFieldBase(queued.fieldBase ?? {}, local, fields)
        const { merged, conflicts } = mergeBusinessFields({
            base,
            remote: remoteEntity,
            local,
            fields,
            lwwWinner: winner
        })
        const mergedFields = Object.fromEntries(
            Object.entries(merged).filter(([, value]) => value !== undefined)
        )
        const remoteUpdatedAt =
            typeof remoteEntity.updatedAt === 'string' ? remoteEntity.updatedAt : ''
        const businessChanged = Object.keys(mergedFields).some(
            (field) => !valuesEqual(mergedFields[field], local[field])
        )
        const baseChanged =
            remoteUpdatedAt !== '' && localRecord.syncedServerUpdatedAt !== remoteUpdatedAt
        // 基准只前进（R-6）：合并后 `fieldBase` = 远端当前域值（下一轮判据稳定、重复 pull 幂等）
        const retiredBase: Record<string, unknown> = {}
        for (const field of fields) {
            if (isMergeDomainField(field)) retiredBase[field] = remoteEntity[field]
        }
        const queueBaseChanged = !this.fieldBaseEquals(queued.fieldBase, retiredBase)
        // 落库行必须走 **entity → record**（`name`/`description` 落库为 `plain:<明文>`，
        // ⛔ 不能把实体明文直接 spread 进记录）；加解密在事务外完成（Dexie 事务内禁 await 外部 Promise）。
        let nextRecord: Record<string, unknown> | undefined
        if (businessChanged || baseChanged) {
            const nextEntity = { ...local, ...(businessChanged ? mergedFields : {}) }
            const source =
                config.table === 'tasks'
                    ? { ...nextEntity, projectId: toLocalProjectId(nextEntity.projectId, userId) }
                    : nextEntity
            nextRecord = (await config.entityToRecord(source, userId)) as Record<string, unknown>
            const nextBase = baseChanged ? remoteUpdatedAt : localRecord.syncedServerUpdatedAt
            if (typeof nextBase === 'string' && nextBase) {
                nextRecord.syncedServerUpdatedAt = nextBase
            }
        }
        let written = false
        if (nextRecord || queueBaseChanged) {
            const rawTable = this.rawTableOf(config)
            // 行 + 基准同事务（AC3：抛错时整体回滚，不留下「已落库但基准未推进」或反之）
            await localDatabase.transaction('rw', rawTable, localDatabase.syncQueue, async () => {
                if (nextRecord) {
                    await rawTable.put(nextRecord)
                    written = true
                }
                if (queueBaseChanged) {
                    await localDatabase.syncQueue.update(`${userId}:${config.table}:${entityId}`, {
                        fieldBase: retiredBase
                    })
                }
            })
        }
        // T683 / M6（NFR 可观测）：合并已应用次数 + 结构化事件（⛔ 不含业务值）
        if (businessChanged || conflicts.length > 0) {
            syncStatus.reportFieldMerge()
            logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_FIELD_MERGE_APPLIED, {
                userId,
                table: config.table,
                conflicts: conflicts.length
            })
        }
        // 落库成功后才记账（AC3）：无冲突 = 全部自动合并，0 记账（R-3）
        if (conflicts.length > 0) {
            const remoteUpdatedAtValue = remoteUpdatedAt || undefined
            const loser: Record<string, unknown> =
                winner === 'remote' ? await config.recordToEntity(localRecord) : { id: entityId }
            if (winner === 'local') {
                // R-H：快照只含**冲突字段**（合并成功的字段不入账，AC5-⑧）
                for (const field of conflicts) {
                    loser[field] = remoteEntity[field] === undefined ? null : remoteEntity[field]
                }
            }
            const count = await appendConflict(userId, {
                kind: winner === 'remote' ? 'remote-wins' : 'pull-local-wins',
                table: config.table,
                entityId,
                loser,
                winnerUpdatedAt: winner === 'remote' ? remoteUpdatedAtValue : queued.localUpdatedAt,
                loserUpdatedAt: winner === 'remote' ? queued.localUpdatedAt : remoteUpdatedAtValue,
                // T682 / M5（additive）：字段级信号（冲突字段；提醒组含整组四字段）
                conflictFields: conflicts
            })
            syncStatus.setConflictCount(count)
        }
        // 我方是否还有字段可保留（远端胜支据此决定是否出队）：合并结果与远端逐字段相等 ⇒ 无
        const keptLocalFields = Object.keys(mergedFields).some(
            (field) => !valuesEqual(mergedFields[field], remoteEntity[field])
        )
        return { written, keptLocalFields, conflicts }
    }

    /**
     * 字段级基准补齐（T679 / M3）
     * @description `fieldBase` 只含「我改过的字段」⇒ 缺失字段的基准 = **本地当前值**（= 我未改）
     *              ⇒ 三方判定里 `L==B` ⇒ 取远端值（这正是「不同字段互不覆盖」的前提）。
     *              ⛔ 整份 `fieldBase` 缺失不在此处理（调用方直接走今日分支 = 保守）。
     */
    private augmentFieldBase(
        fieldBase: Record<string, unknown>,
        local: Record<string, unknown>,
        fields: readonly string[]
    ): Record<string, unknown> {
        const base: Record<string, unknown> = {}
        for (const field of fields) {
            base[field] = Object.prototype.hasOwnProperty.call(fieldBase, field)
                ? fieldBase[field]
                : local[field]
        }
        return base
    }

    /** 字段级基准是否等价（逐字段 `valuesEqual`；键集不一致 ⇒ 不等价） */
    private fieldBaseEquals(
        left: Record<string, unknown> | undefined,
        right: Record<string, unknown>
    ): boolean {
        if (!left) return false
        const keys = Object.keys(right)
        if (Object.keys(left).length !== keys.length) return false
        return keys.every((field) => valuesEqual(left[field], right[field]))
    }

    /**
     * T680 / M4：push `stale` 回执侧字段级合并（`tasks` × `upsert` × 有 `fieldBase` × 有 `serverCurrent`）
     *
     * @description 与 pull 侧**同一内核 / 同一三守卫**（完整合并域 / 过滤 `undefined` / 部分行覆盖 +
     *              base 单独推进 + `deletedAt` 保留）。差异：
     *              - `R` = 回执 `serverCurrent`（服务端当前行，经 `resToEntity` 归一）
     *              - 冲突 winner = **显式 `'local'`**（⛔ 不依赖默认值）
     *              - **保队列**：合并结果 + 新 base 由下一轮 push 收敛（AC4，网络往返不增加）
     *              - **`fieldBase` 退役为完整合并域**（`679b` 判据 5 第二前提）：否则
     *                「partial base + 漏捕写 + 重试」会拼出「我的改动被静默取远端」路径
     *              - AC12：写库前在**同一事务内**复核队列 `revision`；推送期间有新本地写 ⇒ 放弃本次合并
     *              - AC3 同源：**落库成功后才记账**；无冲突 ⇒ 0 记账（AC4）；⛔ 本步不加 `conflictFields`（M5）
     *
     * @returns 三种状态（`T681` / F1，ADR「并发守卫的正确语义」）：
     *          - `handled: true` ⇒ 合并已处理（含「无差异」）⇒ 调用方保队列、跳过今日兜底；
     *          - `aborted: true` ⇒ 回执在飞期间有**新本地写**（`revision` 变）⇒ **直接 `continue`**：
     *            ⛔ 不记账、⛔ 不写回 base、⛔ 不出队（回落今日分支会拿「从未推送的新值」当 loser、
     *            并写回 base ⇒ 下一轮 `applied` 整行覆盖远端异字段）；
     *          - 两者皆 false ⇒ `unavailable`（本地行已物理缺失）⇒ 调用方回落今日 `stale` 分支。
     */
    private async applyPushFieldMerge(
        config: SyncTableConfig,
        item: SyncQueueRecord,
        snapshot: number,
        serverCurrent: Record<string, unknown>,
        serverUpdatedAt: string | undefined,
        userId: string
    ): Promise<{ handled: boolean; aborted: boolean }> {
        const localRecord = await this.tableOf(config).get(item.entityId)
        if (!localRecord) return { handled: false, aborted: false }
        const local = await config.recordToEntity(localRecord)
        const serverEntity = config.resToEntity(serverCurrent) as Record<string, unknown>
        // 形状对齐：与 pull 侧一致（`tasks.projectId` 服务端隐式桶 ⇒ 本地字面 `'inbox'`）
        const remote =
            config.table === 'tasks'
                ? { ...serverEntity, projectId: toLocalProjectId(serverEntity.projectId, userId) }
                : serverEntity
        const fields = Object.keys(config.entityToPush(remote))
        const base = this.augmentFieldBase(item.fieldBase ?? {}, local, fields)
        const { merged, conflicts } = mergeBusinessFields({
            base,
            remote,
            local,
            fields,
            lwwWinner: 'local'
        })
        const mergedFields = Object.fromEntries(
            Object.entries(merged).filter(([, value]) => value !== undefined)
        )
        const nextBase =
            serverUpdatedAt ??
            (typeof remote.updatedAt === 'string' ? (remote.updatedAt as string) : '')
        const businessChanged = Object.keys(mergedFields).some(
            (field) => !valuesEqual(mergedFields[field], local[field])
        )
        const baseChanged = nextBase !== '' && localRecord.syncedServerUpdatedAt !== nextBase
        // 不变量（679b 判据 5）：合并后 `fieldBase` = **完整合并域**（键集 = entityToPush 键集）
        const retiredBase: Record<string, unknown> = {}
        for (const field of fields) {
            if (isMergeDomainField(field)) retiredBase[field] = remote[field]
        }
        const queueBaseChanged = !this.fieldBaseEquals(item.fieldBase, retiredBase)
        let nextRecord: Record<string, unknown> | undefined
        if (businessChanged || baseChanged) {
            const nextEntity = { ...local, ...(businessChanged ? mergedFields : {}) }
            const source =
                config.table === 'tasks'
                    ? { ...nextEntity, projectId: toLocalProjectId(nextEntity.projectId, userId) }
                    : nextEntity
            nextRecord = (await config.entityToRecord(source, userId)) as Record<string, unknown>
            if (nextBase) nextRecord.syncedServerUpdatedAt = nextBase
        }
        let handled = !(nextRecord || queueBaseChanged)
        let aborted = false
        let written = false
        if (nextRecord || queueBaseChanged) {
            const rawTable = this.rawTableOf(config)
            await localDatabase.transaction('rw', rawTable, localDatabase.syncQueue, async () => {
                // AC12（T681 / F1）：推送期间有新本地写（revision 变化）⇒ **放弃本轮合并**
                //   ⇒ 调用方 `continue`（不记账 / 不写回 base / 不出队），下一轮 `stale` 走完整合并
                const current = await localDatabase.syncQueue.get(item.id)
                if (!current || (current.revision ?? 0) !== snapshot) {
                    aborted = true
                    handled = false
                    return
                }
                if (nextRecord) {
                    await rawTable.put(nextRecord)
                    written = true
                }
                if (queueBaseChanged) {
                    await localDatabase.syncQueue.update(item.id, { fieldBase: retiredBase })
                }
                handled = true
            })
        }
        if (written) this.notifyDataChanged()
        // T683 / M6（NFR 可观测）：合并已应用次数 + 结构化事件（⛔ 不含业务值）
        if (handled && (businessChanged || conflicts.length > 0)) {
            syncStatus.reportFieldMerge()
            logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_FIELD_MERGE_APPLIED, {
                userId,
                table: config.table,
                conflicts: conflicts.length
            })
        }
        if (handled && conflicts.length > 0) {
            // 冲突仍可见（kind 沿用既有 `stale`，loser = 我的整行 + `serverCurrent`）；无冲突 = 0 记账
            const loser = await config.recordToEntity(localRecord)
            const count = await appendConflict(userId, {
                kind: 'stale',
                table: config.table,
                entityId: item.entityId,
                loser,
                ...(serverUpdatedAt === undefined ? {} : { winnerUpdatedAt: serverUpdatedAt }),
                loserUpdatedAt: item.localUpdatedAt,
                serverCurrent,
                // T682 / M5（additive）：字段级信号（冲突字段；提醒组含整组四字段）
                conflictFields: conflicts
            })
            syncStatus.setConflictCount(count)
        }
        return { handled, aborted }
    }

    /**
     * 消费派生行版本回执（T326 / B②，客户端半边；服务端字段由 T327 提供）
     * @description 同一批 push 中，服务端对子实体（检查项/评论/子任务）的写入会**派生推进父任务/清单**
     *              的 `updated_at` 却不回传（RC-1）⇒ 客户端 base 静默过期 ⇒ 下次 push `stale`。
     *              本方法把回执声明的**被派生行当前服务端版本**写回该行 base（仅改 base、不动业务字段、
     *              不 markDirty）⇒ 下一次 push 以新 base 命中。
     *
     *              期望字段（供 T327 对齐，RFC3339Milli）：
     *              `derivedUpdates: Array<{ table: string; id: string; updatedAt: string }>`
     *              **缺省 / 非数组 / 未知表 / 空 id / 空 updatedAt ⇒ 完全 no-op**（旧服务端行为逐字不变）。
     */
    private async applyDerivedUpdates(updates: unknown): Promise<void> {
        if (!Array.isArray(updates)) return
        for (const entry of updates) {
            if (!entry || typeof entry !== 'object') continue
            const { table, id, updatedAt } = entry as {
                table?: unknown
                id?: unknown
                updatedAt?: unknown
            }
            if (typeof table !== 'string' || typeof id !== 'string' || id === '') continue
            if (typeof updatedAt !== 'string' || updatedAt === '') continue
            if (!SYNC_TABLES.some((c) => c.table === table)) continue
            await this.writeBackSyncBase(table, id, updatedAt)
        }
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
                // PS-14/DP-1：恢复冲突记账条数（冷启动状态面可见「冲突 N」）
                await this.restoreConflictCount()
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
            logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_RUN_UNEXPECTED_ERROR, {
                userId: this.currentUserId() ?? undefined,
                phase,
                reason: err instanceof Error ? err.name : typeof err
            })
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
        // D6：会话结束后后台同步**零请求**（不清队列；重新登录后由既有触发源补拉）
        if (this.hasEndedSession()) return
        await this.withPullLock(userId, () => this.pullAllInnerLocked(userId))
    }

    /**
     * pull 单主（`navigator.locks`，`ifAvailable` 语义；C-66）
     * @description web 多标签同 origin 可能并发 pull ⇒ 需跨标签选主（desktop 单实例锁下恒无争用）。
     *              **未取得锁 ⇒ 跳过本次 pull**（不排队等待、不阻塞 UI）；此时**不得**置
     *              `pullExecuted`（确实没拉）⇒ 恰好使 web 只读闸门的「离线进入 flag」不被误清
     *              （T108 解除条件 = `ok && !credentialFailure && pullExecuted`）。
     *              环境无 `navigator.locks`（老浏览器/测试）⇒ 记日志 + **直接执行**（不得因此失败）。
     *              锁由 API 在回调结束/异常时自动释放，**不手工 release**。
     */
    private async withPullLock(userId: string, run: () => Promise<void>): Promise<void> {
        const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
        if (!locks || typeof locks.request !== 'function') {
            logStructured('warn', STRUCTURED_LOG_EVENTS.SYNC_PULL_LOCK_UNAVAILABLE, { userId })
            await run()
            return
        }
        let acquired = false
        await locks.request(`${PULL_LOCK_PREFIX}${userId}`, { ifAvailable: true }, async (lock) => {
            if (!lock) return
            acquired = true
            await run()
        })
        if (!acquired) {
            logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_PULL_LOCK_SKIPPED, { userId })
        }
    }

    /**
     * 拉取主体（已持 pull 单主锁）
     * @description 锁获取在 `pullAllInner` 完成 ⇒ **未取得锁不会进入本方法**，
     *              `pullExecuted` 保持 `false`（T107c 自洽性）。
     */
    private async pullAllInnerLocked(userId: string): Promise<void> {
        // T107c：拉取阶段真实进入（唯一设置点）；`start()` 的注销宽限期/无会话早退
        // 不经过此处 ⇒ `pullExecuted=false`。**禁改为从 ok/lastSyncAt 反推**
        //（早退经 runFull → endRun 仍返回 ok=true 并推进 lastSyncAt）
        syncStatus.markPullExecuted()
        logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_PULL_STARTED, { userId })
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
                // T558：记下本次请求**自带出去**的 token 快照，供 10041 处置判「陈旧响应」
                const pullHeaders = this.authHeaders()
                try {
                    response = await this.requester.post('/sync/pull', pullBody, {
                        headers: pullHeaders
                    })
                } catch (err) {
                    // HTTP 4xx/5xx：区分鉴权失败（不误报网络错误，提示重新登录）
                    this.pullIncomplete = true
                    const status = (err as { response?: { status?: number } })?.response?.status
                    if (status === 401 || status === 403) {
                        logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED, {
                            userId,
                            kind: 'expired',
                            status
                        })
                        syncStatus.noteRunError('pull', ERR_PULL_EXPIRED)
                    } else {
                        logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED, {
                            userId,
                            kind: 'network',
                            status
                        })
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
                    // T558：陈旧快照 / 轮换宽限内 ⇒ 只记录，不清凭证不导航
                    if (this.skipStaleCredentialFailure(pullHeaders, 'pull', userId)) return
                    logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED, {
                        userId,
                        kind: 'credential'
                    })
                    syncStatus.markCredentialFailure()
                    this.notifySessionExpired()
                    syncStatus.noteRunError('pull', ERR_SESSION_EXPIRED)
                    return
                }
                if (typeof raw?.code === 'string' || data?.data === null) {
                    this.pullIncomplete = true
                    logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED, {
                        userId,
                        kind: 'network',
                        code: raw?.code
                    })
                    syncStatus.noteRunError('pull', ERR_PULL_NETWORK)
                    return
                }
                // T657 / DEF-140：**业务码 + 无数据信袋**不得当「空拉取成功」
                //   限流 / 拒绝形态 = HTTP 200 + 业务码 + 无 `data`；旧实现 `?? {}` ⇒ 逐表 `pending.delete`
                //   ⇒ `pending.size===0` ⇒ `markMirrorPulled()` ⇒ `ok:true`（假绿 + 骗过自动刷新门控）。
                //   现口径（白名单，非「非 0 即失败」）：
                //   - 无表信袋且 `code` ∉ 成功码 ⇒ **失败**（不推进新鲜度 / 不删 pending / 不广播 / 走退避）；
                //   - `code` 命中成功码（含 `data.data = {}` 的正常空拉取）⇒ 成功（DEF-6 补拉前提）。
                const pullCode = (data as { code?: unknown } | undefined)?.code
                const pulledTables = (data?.data as { data?: unknown } | undefined)?.data
                if (pulledTables === undefined || pulledTables === null) {
                    if (!PULL_SUCCESS_CODES.includes(pullCode)) {
                        this.pullIncomplete = true
                        const rateLimited = PULL_RATE_LIMIT_CODES.includes(pullCode)
                        logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED, {
                            userId,
                            kind: 'business',
                            code: typeof pullCode === 'number' ? pullCode : undefined,
                            rateLimited
                        })
                        syncStatus.noteRunError(
                            'pull',
                            rateLimited ? ERR_PULL_RATE_LIMITED : ERR_PULL_DATA
                        )
                        return
                    }
                }
                // T326 / AC-T325-1：serverTime 在 SyncPullRes 内（`body.data.serverTime`），非 `body.serverTime`
                this.calibrateServerTime(
                    (data?.data as { serverTime?: string | number } | undefined)?.serverTime
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
            logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_PULL_COMPLETED, {
                userId,
                rounds,
                written: writtenCount,
                truncated: pending.size > 0
            })
            if (pending.size === 0) {
                // T654 / R-6 / R-9：**完整拉取**才算「上次成功拉取」——
                //   触顶截断（`pending.size > 0`）仍有后续补拉要跑，⛔ 不得被合并门挡下（DEF-6 回归），
                //   故只在取尽时推进合并门时间并广播「已拉取」。
                // T659：**先落盘再广播**（非主标签收到广播后要读这份 meta 收敛新鲜度）。
                this.lastPullSucceededAt = Date.now()
                this.pullBroadcast.post(userId, this.lastPullSucceededAt)
            }
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
        // T679 / M3：回滚开关（ADR D7，读取点唯一 = `resolveMergeMode`）
        // `lww` ⇒ 整批跳过合并路径，逐字走今日两支（一键降级，不是第二套算法）
        const mergeMode = resolveMergeMode()
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
                const remoteDeleted =
                    entity.deletedAt !== null &&
                    entity.deletedAt !== undefined &&
                    entity.deletedAt !== ''
                // T679 / M3：字段级合并只作用于 `tasks` 的 `upsert` 且**有字段级基准**（R-8 / ADR D1）；
                // 墓碑不进合并域（R-4）⇒ 仍走今日「远端胜 + 出队」分支（AC6 删除两护栏）。
                const mergeable =
                    mergeMode === 'merge' &&
                    config.table === 'tasks' &&
                    queued.action === 'upsert' &&
                    queued.fieldBase !== undefined
                const mergeLocalRecord = mergeable ? await this.tableOf(config).get(id) : undefined
                if (mergeLocalRecord && !remoteDeleted) {
                    const winner: MergeWinner = remoteTs > localTs ? 'remote' : 'local'
                    const outcome = await this.applyPullFieldMerge(
                        config,
                        entity,
                        id,
                        queued,
                        mergeLocalRecord,
                        winner,
                        userId
                    )
                    if (outcome.written) written += 1
                    // 远端胜支：合并后我方已无字段可保留（== 远端）⇒ 出队（= 今日行为）；
                    // 仍有我方字段 ⇒ 保队列，由下一轮 push 收敛（D-b2；AC1-Z / AC3 依赖）。
                    if (winner === 'remote' && !outcome.keptLocalFields) {
                        await syncTracker.removeQueued(config.table, id)
                    }
                } else if (remoteTs > localTs) {
                    // PS-14 / DP-1：远端胜 ⇒ 覆盖前记录**败方（本地被覆盖记录）快照**（不静默丢数据）
                    const localRecord = await this.tableOf(config).get(id)
                    if (localRecord) {
                        const loser = await config.recordToEntity(localRecord)
                        const count = await appendConflict(userId, {
                            kind: 'remote-wins',
                            table: config.table,
                            entityId: id,
                            loser,
                            winnerUpdatedAt:
                                typeof entity.updatedAt === 'string' ? entity.updatedAt : undefined,
                            loserUpdatedAt: queued.localUpdatedAt
                        })
                        syncStatus.setConflictCount(count)
                    }
                    // 远程胜：覆盖本地 + 移除队列项（本地修改作废）
                    await this.putPulledRecord(config, entity, userId)
                    await syncTracker.removeQueued(config.table, id)
                    written += 1
                } else if (remoteDeleted) {
                    // A1 墓碑硬约束（T640 Q2）：远端为墓碑时**不得**走本地胜分支 ——
                    //   否则下一步 push 的 base 恰等于墓碑版本，服务端判 Overwrite 并清 `deleted_at`
                    //   ⇒ **确定性复活**。改走「远端胜」语义：应用墓碑 + 出队 + 记本地内容。
                    const localRecord = await this.tableOf(config).get(id)
                    if (localRecord) {
                        const loser = await config.recordToEntity(localRecord)
                        const count = await appendConflict(userId, {
                            kind: 'remote-wins',
                            table: config.table,
                            entityId: id,
                            loser,
                            winnerUpdatedAt:
                                typeof entity.updatedAt === 'string' ? entity.updatedAt : undefined,
                            loserUpdatedAt: queued.localUpdatedAt
                        })
                        syncStatus.setConflictCount(count)
                    }
                    await this.putPulledRecord(config, entity, userId)
                    await syncTracker.removeQueued(config.table, id)
                    written += 1
                } else {
                    // T326 / RC-3 / AC-T325-3：本地胜也把 base 收敛到服务端当前版本
                    //（否则 base 恒旧 ⇒ OCC 下下一次 push 必然 stale）。仅改 base：不动业务字段、不出队。
                    // A1（F-01）：本地胜必须**记账**（loser = 将被覆盖的远端快照，仅 diff 字段 + 身份字段）
                    await this.recordPullLocalWins(
                        config,
                        entity,
                        id,
                        queued.localUpdatedAt,
                        userId
                    )
                    if (typeof entity.updatedAt === 'string' && entity.updatedAt) {
                        await this.writeBackSyncBase(config.table, id, entity.updatedAt)
                    }
                }
            } else {
                // 本地未改：远程覆盖。T326 / RC-5：把「队列再确认 + 写入」收进**同一 Dexie 事务**，
                // 与本地写路径的「写入 + 入队」事务互斥 ⇒ pull 首读队列（空）与写行之间若本地写抢先入队，
                // 事务内的二次确认会发现队列项并**放弃覆盖**（不再有无 journal 的静默覆盖）。
                // 加解密（buildPulledRecord）在事务外完成，避 Dexie 过早提交。
                const record = await this.buildPulledRecord(config, entity, userId)
                const rawTable = this.rawTableOf(config)
                let didWrite = false
                await localDatabase.transaction(
                    'rw',
                    rawTable,
                    localDatabase.syncQueue,
                    async () => {
                        const stillQueued = await localDatabase.syncQueue.get(
                            `${userId}:${config.table}:${id}`
                        )
                        if (stillQueued) return
                        await rawTable.put(record)
                        didWrite = true
                    }
                )
                if (didWrite) written += 1
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

    /** 推送脏队列（串行队列内执行；已加 push 单主锁） */
    private async pushAllInner(): Promise<void> {
        const userId = this.currentUserId()
        if (!userId) return
        // D6：会话结束后停发（队列/游标保留 ⇒ 重新登录后继续推送，不丢未推送修改）
        if (this.hasEndedSession()) return
        await this.withPushLock(userId, () => this.pushAllInnerLocked(userId))
    }

    /**
     * push 单主（`navigator.locks`，`ifAvailable` 语义；ADR §9.3 / R-3）
     * @description 与 `withPullLock` **同构**：web 多标签同 origin 可能并发 push ⇒ 需跨标签选主
     *              （desktop 单实例锁下恒无争用）。**未取得锁 ⇒ 跳过本次 push**（不排队等待、
     *              不发请求、不消耗重试、不改 `nextAttemptAt`），队列保留 ⇒ 由他标签 / 既有触发源
     *              （启动 · `online` · 前台恢复 · 条件退避）补推（守护 R-17「不丢」）。
     *              环境无 `navigator.locks`（老浏览器/测试）⇒ 记日志 + **直接执行**（不得因此失败，
     *              退化为 2A 现状）。锁由 API 在回调结束/异常时自动释放，**不手工 release**。
     *              临界区内含网络往返 + journal 写入（`appendConflict`）⇒ push 侧 journal `meta`
     *              RMW 在多标签间串行（pull 侧 journal 写位于其 pull 锁内；两锁名不同，跨路径并发
     *              见 T166 回执风险）。
     */
    private async withPushLock(userId: string, run: () => Promise<void>): Promise<void> {
        const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
        if (!locks || typeof locks.request !== 'function') {
            logStructured('warn', STRUCTURED_LOG_EVENTS.SYNC_PUSH_LOCK_UNAVAILABLE, { userId })
            await run()
            return
        }
        let acquired = false
        await locks.request(`${PUSH_LOCK_PREFIX}${userId}`, { ifAvailable: true }, async (lock) => {
            if (!lock) return
            acquired = true
            await run()
        })
        if (!acquired) {
            logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_PUSH_LOCK_SKIPPED, { userId })
        }
    }

    /**
     * 推送主体（已持 push 单主锁）
     * @description 锁获取在 `pushAllInner` 完成 ⇒ **未取得锁不会进入本方法**（无网络请求、
     *              不消耗重试、队列保留）。
     */
    private async pushAllInnerLocked(userId: string): Promise<void> {
        const queue = await syncTracker.listDirty(userId)
        try {
            if (queue.length === 0) return
            const nowMs = Date.now()
            // SHELL-06 C-38/C-39：网络暂停期不发起；退避未到期项跳过（旧记录无 nextAttemptAt 视为可推）
            const dueQueue =
                this.pausedUntil > nowMs ? [] : queue.filter((item) => isRetryDue(item, nowMs))
            if (dueQueue.length === 0) return
            // T680 / M4：回滚开关（ADR D7，读取点唯一 = `resolveMergeMode`）
            // `lww` ⇒ 整批跳过回执侧合并，逐字走今日 `stale` 处理（一键降级）
            const mergeMode = resolveMergeMode()

            const pushBody: Record<string, Record<string, unknown>[]> = {}
            const deletions: { table: string; id: string; baseUpdatedAt?: string }[] = []
            // 发送前快照各实体入队 revision：确认后仅当队列项未被推送期间的新修改覆盖才移除，
            // 否则保留下轮重推，避免本地修改被误删丢失（见审查报告缺陷 2；T326 改为 revision 比较，
            // 避免**同毫秒**新写被 `localUpdatedAt` 相等误判为「未变」而误删 —— AC-T325-8）
            const snapshotRevisions = new Map<string, number>()
            // F-09（D7）：留存本次**实际发出**的载荷（按 `table:id`）—— 供回执判「伪 stale」
            const pushedRecords = new Map<string, Record<string, unknown>>()
            for (const item of dueQueue) {
                const config = SYNC_TABLES.find((c) => c.table === item.table)
                if (!config) {
                    // 不可达防御（与写队列同常量源）：仅诊断，归因并入本阶段同一错误上报（见 ADR A-3）
                    logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PUSH_FAILED, {
                        userId,
                        kind: 'missing-table-config',
                        table: item.table
                    })
                    continue
                }
                snapshotRevisions.set(`${item.table}:${item.entityId}`, item.revision ?? 0)
                const record = await this.tableOf(config).get(item.entityId)
                if (!record) {
                    // 本地记录已不存在（物理清理）：按删除推送兜底
                    deletions.push({ table: item.table, id: item.entityId })
                    continue
                }
                if (item.action === 'delete') {
                    // A4（F-04）：删除也走 OCC —— 携带该行 per-row base；行已物理缺失 ⇒ 不带（删除优先）
                    const baseUpdatedAt = (record as { syncedServerUpdatedAt?: string })
                        .syncedServerUpdatedAt
                    deletions.push({
                        table: item.table,
                        id: item.entityId,
                        ...(baseUpdatedAt ? { baseUpdatedAt } : {})
                    })
                    continue
                }
                const entity = await config.recordToEntity(record)
                const target = (pushBody[item.table] ??= [])
                const pushRecord: Record<string, unknown> = {
                    id: item.entityId,
                    ...config.entityToPush(entity)
                }
                // §9.1.2 / R-12：逐条回传 per-row base；缺失 ⇒ **不产出**该字段 ⇒ 服务端维持现行 LWW（向后兼容）
                const baseUpdatedAt = (record as { syncedServerUpdatedAt?: string })
                    .syncedServerUpdatedAt
                if (baseUpdatedAt) pushRecord.baseUpdatedAt = baseUpdatedAt
                target.push(pushRecord)
                pushedRecords.set(`${item.table}:${item.entityId}`, pushRecord)
            }
            if (Object.keys(pushBody).length === 0 && deletions.length === 0) {
                // 到期项均缺表配置（不可达防御）：必须上报运行错误，否则 syncing 卡死且门读到 null ⇒ 假成功
                syncStatus.noteRunError('push', ERR_PUSH_DATA)
                return
            }

            logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_PUSH_STARTED, {
                userId,
                tables: Object.keys(pushBody).length,
                deletions: deletions.length
            })
            let response
            // T558：记下本次请求**自带出去**的 token 快照，供 10041 处置判「陈旧响应」
            const pushHeaders = this.authHeaders()
            try {
                response = await this.requester.post(
                    '/sync/push',
                    { ...pushBody, deletions },
                    { headers: pushHeaders }
                )
            } catch (err) {
                // SHELL-06 C-38：三分类 —— 凭证（401/403）维持会话失效；网络类暂停不计数；其余业务退避
                const status = (err as { response?: { status?: number } })?.response?.status
                const errorClass = classifyPushFailure({ httpStatus: status })
                if (errorClass === 'credential') {
                    logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PUSH_FAILED, {
                        userId,
                        kind: 'expired',
                        status
                    })
                    syncStatus.noteRunError('push', ERR_PUSH_EXPIRED)
                } else if (errorClass === 'network') {
                    logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PUSH_FAILED, {
                        userId,
                        kind: 'network',
                        status
                    })
                    this.pauseForNetworkFailure()
                    syncStatus.noteRunError('push', ERR_PUSH_NETWORK)
                } else {
                    logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PUSH_FAILED, {
                        userId,
                        kind: 'business',
                        status
                    })
                    for (const item of dueQueue) {
                        if (snapshotRevisions.has(`${item.table}:${item.entityId}`)) {
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
                // T558：陈旧快照 / 轮换宽限内 ⇒ 只记录，不清凭证不导航
                if (this.skipStaleCredentialFailure(pushHeaders, 'push', userId)) return
                logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PUSH_FAILED, {
                    userId,
                    kind: 'credential'
                })
                syncStatus.markCredentialFailure()
                this.notifySessionExpired()
                syncStatus.noteRunError('push', ERR_SESSION_EXPIRED)
                return
            }
            if (typeof raw?.code === 'string') {
                // C-38：归一化断网/超时 ⇒ 暂停，不消耗重试额度（不 markFailed）
                logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PUSH_FAILED, {
                    userId,
                    kind: 'network',
                    code: raw?.code
                })
                this.pauseForNetworkFailure()
                syncStatus.noteRunError('push', ERR_PUSH_NETWORK)
                return
            }
            const data =
                (raw?.data as {
                    data?: {
                        results?: PushResult[]
                        serverTime?: string | number
                        derivedUpdates?: unknown
                    }
                }) ?? {}
            // T326 / AC-T325-1：serverTime 在 SyncPushRes 内（`body.data.serverTime`），非 `body.serverTime`
            this.calibrateServerTime(data.data?.serverTime)
            const results = data.data?.results ?? []
            // A4 能力探测（T640 Q4）：删除回执是否带 `outcome` ⇒ 服务端是否支持删除裁决。
            //   新客户端 + 老服务端 ⇒ false：**不得**据「没收到 stale」认定已裁决（也不伪造 stale 记录）。
            const deletionKeys = new Set(
                dueQueue
                    .filter((item) => item.action === 'delete')
                    .map((item) => `${item.table}:${item.entityId}`)
            )
            if (deletionKeys.size > 0) {
                const deletionResults = results.filter((result) =>
                    deletionKeys.has(`${result.table}:${result.id}`)
                )
                if (deletionResults.length > 0) {
                    syncStatus.setDeletionOCCSupported(
                        deletionResults.every(
                            (result) => typeof result.outcome === 'string' && result.outcome !== ''
                        )
                    )
                }
            }
            const resultByKey = new Map(results.map((r) => [`${r.table}:${r.id}`, r]))
            const pushed = new Set(resultByKey.keys())
            let unconfirmed = false
            // T471 / DEF-44：本次推送「非白名单被丢弃字段」的条目级聚合（供 (i) 诊断日志 + (ii) 面板信息条目）
            let droppedFieldRows = 0
            const droppedFieldNames = new Set<string>()
            for (const item of dueQueue) {
                const key = `${item.table}:${item.entityId}`
                const snapshot = snapshotRevisions.get(key)
                if (!pushed.has(key)) {
                    // 响应中无该实体：后端拒绝或字段不匹配 ⇒ 业务类退避（C-38/C-39）
                    if (snapshot !== undefined) {
                        logStructured('warn', STRUCTURED_LOG_EVENTS.SYNC_PUSH_UNCONFIRMED, {
                            userId,
                            table: item.table,
                            entityId: item.entityId
                        })
                        await syncTracker.markBusinessFailure(
                            item.id,
                            this.businessNextAttemptAt(item)
                        )
                        unconfirmed = true
                    }
                    continue
                }
                const result = resultByKey.get(key)
                const outcome = result?.outcome
                // 服务端当前行（A2 / F-09 additive；旧服务端缺省 ⇒ undefined）
                const serverCurrent =
                    result?.serverCurrent && typeof result.serverCurrent === 'object'
                        ? result.serverCurrent
                        : undefined
                // F-09（T644 / D7）：**伪 `stale` 消噪** —— 回执带服务端当前行、且与本次载荷的
                //   **业务字段（哨兵归一后）等价** ⇒ 实为已生效，判 `applied`：写回 base、出队、
                //   **不落账**（否则「内容其实没变」的回执会把真冲突淹没）；不等 ⇒ 仍落账（真 stale）。
                //   ⛔ 删除动作不参与（载荷不在 `pushedRecords` 中，删除裁决不适用）。
                const pushedRecord = pushedRecords.get(key)
                const pseudoApplied =
                    (outcome === 'stale' || outcome === 'noop') &&
                    serverCurrent !== undefined &&
                    pushedRecord !== undefined &&
                    syncPayloadMatchesServer(pushedRecord, serverCurrent)
                const effectiveOutcome = pseudoApplied ? 'applied' : outcome
                // T471 / DEF-44：消费 additive `droppedFields`（缺省/空 ⇒ no-op）；仅**白名单外**计入「真·漂移」
                const unexpectedDroppedFields = pickUnexpectedDroppedFields(
                    result?.droppedFields,
                    item.table
                )
                if (unexpectedDroppedFields.length > 0) {
                    droppedFieldRows += 1
                    for (const field of unexpectedDroppedFields) droppedFieldNames.add(field)
                }
                // §9.1.4 / R-15 / R-18 / DP-2B-4：`error` 必须消费 —— **不出队** + 业务退避
                //   （否则 2A 窄窗：服务端失败但客户端已出队 ⇒ 本地改动静默丢失）
                if (outcome === 'error') {
                    logStructured('warn', STRUCTURED_LOG_EVENTS.SYNC_PUSH_UNCONFIRMED, {
                        userId,
                        table: item.table,
                        entityId: item.entityId,
                        outcome
                    })
                    await syncTracker.markBusinessFailure(item.id, this.businessNextAttemptAt(item))
                    unconfirmed = true
                    continue
                }
                // T680 / M4：push `stale` 回执侧字段级合并（tasks × upsert × 有 fieldBase × 有 serverCurrent）
                //   ⇒ 不记账 / 不删队列项 / base 前进 / fieldBase 退役为完整域；下一轮 push 以新 base 收敛（AC4）。
                //   缺 `serverCurrent` / 删除动作 / 非 tasks / `lww` ⇒ 逐字走今日分支（`t641-a4` 零修改）。
                const staleMergeable =
                    effectiveOutcome === 'stale' &&
                    mergeMode === 'merge' &&
                    item.table === 'tasks' &&
                    item.action === 'upsert' &&
                    item.fieldBase !== undefined &&
                    serverCurrent !== undefined &&
                    snapshot !== undefined &&
                    !(
                        serverCurrent.deletedAt !== null &&
                        serverCurrent.deletedAt !== undefined &&
                        serverCurrent.deletedAt !== ''
                    )
                if (staleMergeable) {
                    const mergeConfig = SYNC_TABLES.find((c) => c.table === item.table)
                    if (mergeConfig) {
                        const mergeOutcome = await this.applyPushFieldMerge(
                            mergeConfig,
                            item,
                            snapshot,
                            serverCurrent,
                            result?.serverUpdatedAt,
                            userId
                        )
                        // T681 / F1：回执在飞期间有新本地写 ⇒ **放弃本轮**（⛔ 不记账 / ⛔ 不写回 base /
                        //   ⛔ 不出队）⇒ 下一轮 `stale` 用新 fieldBase 走完整合并 ⇒ 再下一轮 applied。
                        //   ⛔ 不得回落今日 `stale` 分支（会用「从未推送的新值」当 loser + 写回 base ⇒
                        //   下一轮 applied 整行覆盖远端异字段）。
                        if (mergeOutcome.aborted) continue
                        // 合并已处理（含「无差异」）⇒ 保队列，跳过今日的记账 / base 写回 / 出队
                        if (mergeOutcome.handled) continue
                    }
                }
                // §9.1.4：`noop` / `stale` / `conflict` / `skipped` 全部登记（journal + 可见计数），不静默出队
                //   `noop` / `stale` 带**败方快照**（本地被拒内容）；`conflict` / `skipped` 无快照（仅登记）
                if (
                    effectiveOutcome === 'noop' ||
                    effectiveOutcome === 'stale' ||
                    effectiveOutcome === 'conflict' ||
                    effectiveOutcome === 'skipped'
                ) {
                    const config = SYNC_TABLES.find((c) => c.table === item.table)
                    // A3（F-03）：`conflict`/`skipped` 也留败方内容（含删除动作的本地墓碑行）
                    const record = config
                        ? await this.tableOf(config).get(item.entityId)
                        : undefined
                    if (config) {
                        const loser = record ? await config.recordToEntity(record) : {}
                        const count = await appendConflict(userId, {
                            kind: effectiveOutcome === 'noop' ? 'push-noop' : effectiveOutcome,
                            table: item.table,
                            entityId: item.entityId,
                            loser,
                            ...(result?.serverUpdatedAt === undefined
                                ? {}
                                : { winnerUpdatedAt: result.serverUpdatedAt }),
                            loserUpdatedAt: item.localUpdatedAt,
                            ...(serverCurrent === undefined ? {} : { serverCurrent })
                        })
                        syncStatus.setConflictCount(count)
                    }
                }
                // §9.1.6 写回点：`applied`/`noop`/`stale` 以 `result.serverUpdatedAt` 落回该行 base
                //   （`stale` 时即为库中当前版本，使下次推送以新 base 命中，防 R-20 灾难路径）
                if (
                    (effectiveOutcome === 'applied' ||
                        effectiveOutcome === 'noop' ||
                        effectiveOutcome === 'stale') &&
                    result?.serverUpdatedAt
                ) {
                    await this.writeBackSyncBase(item.table, item.entityId, result.serverUpdatedAt)
                }
                // 推送期间本地对同一实体有新修改（revision 已变化）：保留队列项下轮重推，防止本地修改丢失
                //（T326 / AC-T325-8：比较入队 revision，非毫秒时间戳 ⇒ 同 ms 新写不再被误删）
                const current = await localDatabase.syncQueue.get(item.id)
                if (current && snapshot !== undefined && (current.revision ?? 0) === snapshot) {
                    await syncTracker.removeQueued(item.table, item.entityId)
                }
            }
            // T471 / DEF-44：(i) 结构化日志（仅非白名单 = 真·漂移）+ (ii) 覆盖式落定面板信息条目计数。
            //   ⛔ 不阻塞出队（字段漂移非用户可处置项；阻塞只会把「静默丢字段」换成「永久不出队」）。
            if (droppedFieldRows > 0) {
                logStructured('warn', STRUCTURED_LOG_EVENTS.SYNC_PUSH_DROPPED_FIELDS, {
                    userId,
                    rows: droppedFieldRows,
                    fields: [...droppedFieldNames].sort()
                })
            }
            syncStatus.setDroppedFieldCount(droppedFieldRows)
            // T326 / B②：派生行版本回执（additive；字段缺省/未知表 ⇒ no-op，旧服务端行为逐字不变）
            await this.applyDerivedUpdates(data.data?.derivedUpdates)
            // 部分数据未确认 ⇒ 运行失败（否则门会假成功）；同阶段同类错误只上报一次（见 ADR A-2）
            if (unconfirmed) syncStatus.noteRunError('push', ERR_PUSH_UNCONFIRMED)
            // 全部确认 ⇒ 回传完成：清暂停与退避定时（C-40 成功即停）
            if (!unconfirmed) {
                this.resumeBackfillState()
                this.clearBackfillTick()
            }
            logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_PUSH_COMPLETED, {
                userId,
                confirmed: results.length,
                unconfirmed
            })
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
        // DEF-13：本方法**唯一**由入队侧事件（`syncTracker.setDirtyListener` ⇒ `markDirty`）调用
        // （web `data-plane.ts` / desktop `AppRoot.vue`）⇒ 顺带安排一次待推送数落定
        this.schedulePendingCountSettle()
    }

    /**
     * 入队侧刷新待推送数（DEF-13）
     * @description ⚠️ **这条路径不是运行边界**：不入 `enqueue`、不触发任何网络/同步、不建轮询/定时循环
     *              （每次入队侧事件只重置同一个一次性防抖定时器，末次后读一次队列）。
     *              运行内的最终值仍由 `finishRun` → `endRun` 落定（二者同源同值，见 `settlePendingCount`）。
     *              运行中不落定（`syncing` 为真时跳过）：避免中途数字闪烁，权威值由运行边界给出。
     */
    schedulePendingCountSettle(): void {
        if (this.pendingCountTimer) clearTimeout(this.pendingCountTimer)
        this.pendingCountTimer = setTimeout(() => {
            this.pendingCountTimer = null
            void this.settlePendingCount()
        }, PENDING_COUNT_SETTLE_DEBOUNCE_MS)
    }

    /** 重读本地队列并落定待推送数（只读 Dexie；无会话/运行中不动） */
    private async settlePendingCount(): Promise<void> {
        if (syncStatus.get().syncing) return
        const userId = this.currentUserId()
        if (!userId) return
        syncStatus.settlePendingCount(await syncTracker.countDirty(userId))
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
                // T654 / R-9 合并门：**事件触发**（`online` / 回到可见 / 前台恢复）距上次成功拉取
                //   <10s ⇒ 本轮只推不拉（防 alt-tab / Wi-Fi 抖动放大请求）；
                //   超时/从未成功 ⇒ 正常拉取。手动 `manualSync()` 与本方法无关 ⇒ 永不过门。
                if (!this.isEventPullMerged()) await this.pullAllInner()
                await this.pushAllInner()
            })
        )
        await this.scheduleBackfillTick()
        return result
    }

    /**
     * 事件触发拉取是否已被合并门拦下（T654 / R-9 / AC5b）
     * @description 判据 = 「距上次**成功**拉取」；失败不推进时间戳 ⇒ 失败后的事件触发仍会拉取
     *              （不得把连续失败静默成「已是最新」）。
     */
    private isEventPullMerged(nowMs: number = Date.now()): boolean {
        if (this.lastPullSucceededAt === null) return false
        return nowMs - this.lastPullSucceededAt < EVENT_PULL_MERGE_GATE_MS
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