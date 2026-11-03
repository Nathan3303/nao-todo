/**
 * 冲突记账（PS-14 / DP-1）
 * @description 凡「本地待推修改被远端覆盖」（pull 远端胜）或「push 被服务端 no-op」，
 *              记录事件 + **败方（被覆盖方）内容快照**，满足「不得静默覆盖丢数据」硬约束。
 *              - 存储 = `meta` 表**单记录** `${userId}:conflict-journal`（`MetaRecord.conflictJournal`
 *                纯追加、非索引字段 ⇒ **不 bump Dexie version / 不加索引**，同 `mirror-status` /
 *                `preference-queue` 先例，不触 C-44）；
 *              - **有界**：每用户上限 `CONFLICT_JOURNAL_LIMIT`（环形淘汰，保留最新）；
 *              - 直连表写入，**不触发 `markDirty`**（不污染业务 `syncQueue`）。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md（PS-14 / DP-1）
 */
import {
    localDatabase,
    type ConflictJournalEntry,
    type MetaRecord
} from '../persistence-local/db/local-database'
import { localSession } from '../persistence-local/session/local-session'
import { findConflictEntity } from './conflict-entity-registry'
import { nowCalibratedIso } from './sync-config'
import { toLocalProjectId } from './sync-normalize'
import { syncStatus } from './sync-status'
import { logStructured, STRUCTURED_LOG_EVENTS } from '../observability/structured-log'

export type { ConflictJournalEntry }

/** 每用户冲突记账上限（环形淘汰，保留最新；DP-2B-5：50 → 200 + 折叠提示） */
export const CONFLICT_JOURNAL_LIMIT = 200

/** 冲突记账在 `meta` 表中的主键后缀（非索引字段 ⇒ 不触 C-44） */
const CONFLICT_JOURNAL_SUFFIX = 'conflict-journal'

/** 某用户冲突记账在 `meta` 表中的主键 */
export const conflictJournalId = (userId: string): string => `${userId}:${CONFLICT_JOURNAL_SUFFIX}`

/** 快照文本字段截断上限（R-H：>512 字符截断并标记；T643 / A3） */
export const CONFLICT_SNAPSHOT_TEXT_LIMIT = 512

/** 记录层元字段（非业务内容 ⇒ 不进快照；R-H「禁整行复制」） */
const SNAPSHOT_EXCLUDED_FIELDS: ReadonlySet<string> = new Set([
    'userId',
    'syncedServerUpdatedAt',
    'revision'
])

/** 快照构造结果（截断标记为 PM 冻结形状：`truncated` 布尔 + `truncatedFields` 字段名） */
export interface ConflictSnapshot {
    snapshot: Record<string, unknown>
    truncated: boolean
    truncatedFields: string[]
}

/**
 * 构造 journal 快照：**业务字段 + 身份字段**（剔除记录层元字段），文本 >512 字符截断并登记字段名
 * @description R-H：快照**不得整行复制**；内容必须保留到「用户能认出自己的修改」的程度
 */
export const buildConflictSnapshot = (
    value: Record<string, unknown> | null | undefined
): ConflictSnapshot => {
    const snapshot: Record<string, unknown> = {}
    const truncatedFields: string[] = []
    for (const [field, raw] of Object.entries(value ?? {})) {
        if (SNAPSHOT_EXCLUDED_FIELDS.has(field)) continue
        if (typeof raw === 'string' && raw.length > CONFLICT_SNAPSHOT_TEXT_LIMIT) {
            snapshot[field] = raw.slice(0, CONFLICT_SNAPSHOT_TEXT_LIMIT)
            truncatedFields.push(field)
            continue
        }
        snapshot[field] = raw
    }
    return { snapshot, truncated: truncatedFields.length > 0, truncatedFields }
}

/**
 * 淘汰优先级（数值越大越先被淘汰）：`conflict` 保留位 > `stale/noop/remote-wins/skipped` > `pull-local-wins`
 * @description 上限保持 200 不变；避免伪 `stale` / 拉取本地胜把真冲突挤掉（T640 Q2）
 */
const KIND_EVICTION_RANK: Readonly<Record<ConflictJournalEntry['kind'], number>> = {
    conflict: 0,
    skipped: 1,
    stale: 1,
    'push-noop': 1,
    'remote-wins': 1,
    'pull-local-wins': 2
}

/** 有界裁切：超上限时按淘汰优先级从最不重要的最旧条目开始丢弃 */
const trimJournal = (
    entries: ConflictJournalEntry[]
): { entries: ConflictJournalEntry[]; evicted: number } => {
    let next = entries
    let evicted = 0
    while (next.length > CONFLICT_JOURNAL_LIMIT) {
        let target = 0
        let rank = -1
        for (const [index, entry] of next.entries()) {
            const candidate = KIND_EVICTION_RANK[entry.kind] ?? 1
            if (candidate > rank) {
                rank = candidate
                target = index
            }
        }
        next = [...next.slice(0, target), ...next.slice(target + 1)]
        evicted += 1
    }
    return { entries: next, evicted }
}

/**
 * journal 专用锁名前缀（ADR §9.3：journal 写入须在锁内，**与 pull 侧互斥**）
 * @description pull 单主锁（`nao-todo:pull:`）与 push 单主锁（`nao-todo:push:`）**锁名不同** ⇒
 *              两路径仍可并发对同一 `meta` 单记录（`${userId}:conflict-journal`）做 RMW ⇒
 *              可丢条目。本锁包裹 journal 的 RMW 写入，使**跨路径**写入串行。
 *              锁序固定 `pull/push 锁 → journal 锁`（本锁恒为**最内层**）⇒ 无死锁。
 */
const JOURNAL_LOCK_PREFIX = 'nao-todo:journal:'

/**
 * 在 journal 专用锁内执行 `run`（**等待**取锁，非 `ifAvailable`：journal 写入**不得跳过**）。
 * @description 无 `navigator.locks`（desktop / 老浏览器 / 测试）⇒ 记日志 + 直接执行（退化为现状）。
 */
const withJournalLock = async <T>(userId: string, run: () => Promise<T>): Promise<T> => {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
    if (!locks || typeof locks.request !== 'function') {
        logStructured('warn', STRUCTURED_LOG_EVENTS.SYNC_JOURNAL_LOCK_UNAVAILABLE, { userId })
        return run()
    }
    return (await locks.request(`${JOURNAL_LOCK_PREFIX}${userId}`, () => run())) as T
}

/** journal 变更结果（`entries` = 新条目集；`evictedCount` 缺省 ⇒ 保留原值） */
interface JournalMutation {
    entries: ConflictJournalEntry[]
    evictedCount?: number
}

/**
 * journal 锁内的**原子读-改-写**（ADR §9.3：journal `meta` 单记录的**所有**写者互斥）
 * @description 读与写同在锁内 ⇒ 消除「读在锁外、写在锁内」的丢更新窗口（恢复动作 A/B 曾有此窗口）。
 * @param write 收到锁内读到的条目与记录，返回变更（`null` ⇒ 不落盘）
 * @returns 变更后的条目集（`write` 返回 `null` ⇒ 锁内读到的原条目）
 */
const withJournalRmw = async (
    userId: string,
    write: (context: {
        entries: ConflictJournalEntry[]
        record: MetaRecord | undefined
    }) => JournalMutation | null | Promise<JournalMutation | null>
): Promise<ConflictJournalEntry[]> =>
    withJournalLock(userId, async () => {
        const record = await localDatabase.meta.get(conflictJournalId(userId))
        const entries = record?.conflictJournal ?? []
        const mutation = await write({ entries, record })
        if (!mutation) return entries
        const evictedCount = mutation.evictedCount ?? record?.conflictJournalEvictedCount
        await localDatabase.meta.put({
            id: conflictJournalId(userId),
            conflictJournal: mutation.entries,
            ...(evictedCount === undefined ? {} : { conflictJournalEvictedCount: evictedCount })
        } satisfies MetaRecord)
        return mutation.entries
    })

/** 记账输入（`at` 由本模块生成） */
export interface ConflictJournalInput {
    kind: ConflictJournalEntry['kind']
    table: string
    entityId: string
    /** 败方（被覆盖方）实体快照（明文） */
    loser: Record<string, unknown>
    winnerUpdatedAt?: string
    loserUpdatedAt?: string
    /** 服务端当前行（A2 additive `serverCurrent`；仅 `stale` 回执携带） */
    serverCurrent?: Record<string, unknown>
}

/** 读取冲突记账（无记录 ⇒ 空数组；按记账顺序，末尾为最新） */
export const loadConflictJournal = async (userId: string): Promise<ConflictJournalEntry[]> => {
    if (!userId) return []
    const record = await localDatabase.meta.get(conflictJournalId(userId))
    return record?.conflictJournal ?? []
}

/**
 * 冲突「对象数」= distinct `table:entityId`（T346 统一计数口径）。
 * @description **单一真源**：由 journal 条目派生，与状态面 `conflictCount` 同源（不新增第二计数源）。
 */
export const conflictObjectCount = (
    entries: ReadonlyArray<{ table: string; entityId: string }>
): number => new Set(entries.map((entry) => `${entry.table}:${entry.entityId}`)).size

/** 冲突「对象数」（distinct 实体；冷启动恢复状态面计数用；无记录 ⇒ 0） */
export const countConflicts = async (userId: string): Promise<number> =>
    conflictObjectCount(await loadConflictJournal(userId))

/**
 * 追加一条冲突记账（**纯追加 + 有界**：超上限环形淘汰最旧）
 * @returns 追加后的**对象数**（distinct 实体；供状态面计数，T346 口径）
 * @description 空 `userId` 硬失败（C-55：不得退化为空用户读写）
 */
export const appendConflict = async (
    userId: string,
    input: ConflictJournalInput
): Promise<number> => {
    if (!userId) return 0
    // R-H / A3：快照 = 业务字段子集；文本 >512 字符截断并标记（truncated + truncatedFields）
    const { snapshot, truncated, truncatedFields } = buildConflictSnapshot(input.loser)
    // 跨路径互斥（ADR §9.3）：pull 的 remote-wins 与 push 的 stale/noop/... 均经本入口 ⇒
    // 同一 `meta` 单记录的 RMW 在 journal 锁内串行（锁序：pull/push 锁 → journal 锁，最内层）
    const next = await withJournalRmw(userId, ({ entries, record }) => {
        // A1 去重：同一裁决 `(table, entityId, kind, winnerUpdatedAt)` 重复出现 ⇒ 仅 `occurrences += 1`
        //   （仅 `pull-local-wins`：pull 会反复跑在同一 queued 实体上）
        if (input.kind === 'pull-local-wins' && input.winnerUpdatedAt !== undefined) {
            const index = entries.findIndex(
                (candidate) =>
                    candidate.kind === 'pull-local-wins' &&
                    candidate.table === input.table &&
                    candidate.entityId === input.entityId &&
                    candidate.winnerUpdatedAt === input.winnerUpdatedAt
            )
            if (index >= 0) {
                return {
                    entries: entries.map((candidate, position) =>
                        position === index
                            ? { ...candidate, occurrences: (candidate.occurrences ?? 1) + 1 }
                            : candidate
                    )
                }
            }
        }
        const entry: ConflictJournalEntry = {
            kind: input.kind,
            table: input.table,
            entityId: input.entityId,
            loser: snapshot,
            ...(input.winnerUpdatedAt === undefined
                ? {}
                : { winnerUpdatedAt: input.winnerUpdatedAt }),
            ...(input.loserUpdatedAt === undefined ? {} : { loserUpdatedAt: input.loserUpdatedAt }),
            ...(input.serverCurrent === undefined ? {} : { serverCurrent: input.serverCurrent }),
            ...(truncated ? { truncated: true, truncatedFields } : {}),
            ...(input.kind === 'pull-local-wins' ? { occurrences: 1 } : {}),
            at: new Date().toISOString()
        }
        // R-15：环形淘汰（上限 200 不变，按优先级裁切）累计计数（同一次 RMW ⇒ 无第二处写点）
        const trimmed = trimJournal([...entries, entry])
        return {
            entries: trimmed.entries,
            evictedCount: (record?.conflictJournalEvictedCount ?? 0) + trimmed.evicted
        }
    })
    return conflictObjectCount(next)
}

/** 清空冲突记账（登出/清库随 `meta` 一并清除；此处供显式清理） */
export const clearConflictJournal = async (userId: string): Promise<void> => {
    if (!userId) return
    await localDatabase.meta.delete(conflictJournalId(userId))
}

// ---------------------------------------------------------------------------
// T165 / W3 —— 冲突解决 UX API（ADR §9.2）
// 第二段：列表/对比/两种恢复动作 + 折叠信号（`folded` / `foldedReason`）。
// ---------------------------------------------------------------------------

/** 折叠提示阈值（journal 达此条数 ⇒ UI 提示「更早冲突已折叠」；≤ `CONFLICT_JOURNAL_LIMIT`） */
export const CONFLICT_FOLD_HINT_THRESHOLD = 200

/**
 * 列表展示有快照的冲突类型
 * @description 列表保持既有语义（`conflict`/`skipped` ⇒ `null`，由 `conflict-ux-api.test.ts` 守护）；
 *              `pull-local-wins`（A1）新增，败方 = 将被本地覆盖的**远端**快照
 */
const LIST_SNAPSHOT_KINDS: ReadonlySet<ConflictJournalEntry['kind']> = new Set([
    'remote-wins',
    'push-noop',
    'stale',
    'pull-local-wins'
])

/** 详情/导出可见快照的类型（T643 / A3：`conflict`/`skipped` 也必须能看到败方内容） */
const DETAIL_SNAPSHOT_KINDS: ReadonlySet<ConflictJournalEntry['kind']> = new Set([
    'remote-wins',
    'push-noop',
    'stale',
    'pull-local-wins',
    'conflict',
    'skipped'
])

/** 可「以我的版本重试」的类型（仅本地有完整可重放快照的三种；`conflict`/`skipped` 不支持） */
const RETRY_SNAPSHOT_KINDS: ReadonlySet<ConflictJournalEntry['kind']> = new Set([
    'remote-wins',
    'push-noop',
    'stale'
])

/** 冲突列表项（UI 渲染用；只读快照） */
export interface ConflictListItem {
    /** 条目稳定 id：`${table}:${entityId}:${at}` */
    id: string
    kind: ConflictJournalEntry['kind']
    table: string
    entityId: string
    /** 败方（被覆盖方）快照；无快照的 kind（`conflict`/`skipped`）⇒ `null` */
    loser: Record<string, unknown> | null
    winnerUpdatedAt?: string
    loserUpdatedAt?: string
    at: string
}

/** 冲突列表结果（含折叠信号） */
export interface ConflictListResult {
    items: ConflictListItem[]
    /** 折叠信号：`foldedReason !== null`（= 已达上限 或 曾淘汰） */
    folded: boolean
    /** 折叠原因：`'limit'` = 达 `CONFLICT_FOLD_HINT_THRESHOLD`；`'evicted'` = 曾淘汰过；皆否 ⇒ `null` */
    foldedReason: 'limit' | 'evicted' | null
}

/** 只读字段级差异（仅展示，不自动合并） */
export interface ConflictFieldDiff {
    field: string
    loser: unknown
    current: unknown
}

/** 只读对比数据面：败方快照 vs 本地当前行 */
export interface ConflictComparison {
    table: string
    entityId: string
    /** 败方（journal 快照；无快照 ⇒ `null`） */
    loser: Record<string, unknown> | null
    /** 本地当前行（胜方；明文；行不存在 ⇒ `null`） */
    current: Record<string, unknown> | null
    /** 字段级差异（仅展示，不自动合并） */
    diffs: ConflictFieldDiff[]
}

/** 恢复动作结果 */
export interface ConflictResolutionResult {
    ok: boolean
    /** 动作后该用户剩余**对象数**（distinct 实体，T346 口径；供状态面计数刷新） */
    remaining: number
    /**
     * 「待下次同步生效」（PM 冻结形状；T643 / A2）
     * @description 旧服务端回执无 `serverCurrent` ⇒ 本次无法真写回 ⇒ 不得 `ok:true` 假装已生效
     */
    pendingNextSync?: true
    /** 失败原因码（UI 映射为用户可读文案；不裸露内部术语） */
    error?:
        | 'pending-next-sync'
        | 'local-edited'
        | 'snapshot-expired'
        | 'decrypt-failed'
        | 'unsupported'
}

/** 冲突条目 → 列表项（UI 面） */
const toConflictListItem = (entry: ConflictJournalEntry): ConflictListItem => ({
    id: `${entry.table}:${entry.entityId}:${entry.at}`,
    kind: entry.kind,
    table: entry.table,
    entityId: entry.entityId,
    loser: LIST_SNAPSHOT_KINDS.has(entry.kind) ? entry.loser : null,
    ...(entry.winnerUpdatedAt === undefined ? {} : { winnerUpdatedAt: entry.winnerUpdatedAt }),
    ...(entry.loserUpdatedAt === undefined ? {} : { loserUpdatedAt: entry.loserUpdatedAt }),
    at: entry.at
})

/**
 * 列表：读冲突记账（含折叠信号）—— 供冲突列表 UI 渲染
 * @returns `items` 按记账顺序（末尾最新）；`folded`/`foldedReason` 区分「已达上限」与「曾淘汰」
 */
export const listConflicts = async (userId: string): Promise<ConflictListResult> => {
    if (!userId) return { items: [], folded: false, foldedReason: null }
    const record = await localDatabase.meta.get(conflictJournalId(userId))
    const entries = record?.conflictJournal ?? []
    const evicted = (record?.conflictJournalEvictedCount ?? 0) > 0
    const atLimit = entries.length >= CONFLICT_FOLD_HINT_THRESHOLD
    return {
        items: entries.map(toConflictListItem),
        folded: evicted || atLimit,
        foldedReason: evicted ? 'evicted' : atLimit ? 'limit' : null
    }
}

/** 深比较（数组/对象按 JSON 比较；`undefined`/缺失 视为不相等） */
const valuesEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true
    if (a === null || b === null || a === undefined || b === undefined) return false
    if (typeof a !== 'object' || typeof b !== 'object') return false
    try {
        return JSON.stringify(a) === JSON.stringify(b)
    } catch {
        return false
    }
}

/**
 * 逐字段差异（**仅差异**入列；任一侧缺失时以 `null` 呈现）
 *
 * @description 比较面 = **败方快照的键集**（`Object.keys(loser)`），不是 `loser ∪ current`。
 *   loser 是**部分快照**（A1/A3 只存 diff 字段 + 身份字段，见 ADR `R-H`），current 是
 *   `recordToEntity(record)` 的**完整实体** ⇒ 若对两侧键集求并集，只在 current 出现的字段
 *   会全部被判「新增」（反之「删除」），详情面板因此展示大量**没被改过**的字段（DEF-133）。
 *   快照定义了「本次比较面」：快照里有、当前行取不到 ⇒ removed；两侧都有且不等 ⇒ changed；
 *   **不因** current 多出键而产出 added。
 */
const diffFields = (
    loser: Record<string, unknown> | null,
    current: Record<string, unknown> | null
): ConflictFieldDiff[] => {
    const diffs: ConflictFieldDiff[] = []
    for (const field of Object.keys(loser ?? {})) {
        const loserValue = loser ? (loser[field] ?? null) : null
        const currentValue = current ? (current[field] ?? null) : null
        if (!valuesEqual(loserValue, currentValue)) {
            diffs.push({ field, loser: loserValue, current: currentValue })
        }
    }
    return diffs
}

/** 取该实体**最新**一条 journal 条目（末尾最新） */
const latestEntry = (
    entries: ConflictJournalEntry[],
    table: string,
    entityId: string
): ConflictJournalEntry | undefined =>
    [...entries].reverse().find((entry) => entry.table === table && entry.entityId === entityId)

/**
 * 只读对比：`table:entityId` 的败方快照 vs 本地当前行（字段级差异仅展示，不自动合并）
 * @returns 无该条目 ⇒ `null`；本地当前行缺失 ⇒ `current: null`（不抛错、不臆造结论）
 */
export const compareConflict = async (
    userId: string,
    table: string,
    entityId: string
): Promise<ConflictComparison | null> => {
    if (!userId) return null
    const entry = latestEntry(await loadConflictJournal(userId), table, entityId)
    if (!entry) return null
    const loser = DETAIL_SNAPSHOT_KINDS.has(entry.kind) ? entry.loser : null
    const config = findConflictEntity(table)
    let current: Record<string, unknown> | null = null
    if (config) {
        const record = await config.getRecord(entityId)
        if (record) current = await config.recordToEntity(record)
    }
    return { table, entityId, loser, current, diffs: diffFields(loser, current) }
}

/**
 * 恢复动作 A「保留服务端版本」：**真写回本地**（T643 / A2）
 *
 * 语义 = 服务端行 → 本地行（逐字段） + 保留新 base + 清队列/条目（R-E / AC2）。
 * 四条例外（逐条，不简化）：
 *  - ① 本地又有新编辑 ⇒ 拒绝写回 + 保留条目 + 不丢新编辑；
 *  - ② 删除中 ⇒ 不复活、保留删除意图 + 清条目；
 *  - ③ 解密/转换失败 ⇒ fail-soft（不改行 + 不清条目 + 可见失败）；
 *  - ④ 快照已过期（base 已新于快照）⇒ base 只前进不回退，不写回旧快照。
 * 正常路径为**单 Dexie 事务**（业务表 + `syncQueue` + `meta`）；旧服务端（无 `serverCurrent`）
 * ⇒ `pendingNextSync: true`（**不得**假装已生效）。
 */
export const resolveConflictKeepServer = async (
    userId: string,
    table: string,
    entityId: string
): Promise<ConflictResolutionResult> => {
    if (!userId) return { ok: true, remaining: 0 }
    const config = findConflictEntity(table)
    // 读-改-写同在 journal 锁内 ⇒ 与后台 `appendConflict` 并发不丢条目（ADR §9.3）
    return withJournalLock(userId, async () => {
        const metaRecord = await localDatabase.meta.get(conflictJournalId(userId))
        const entries = metaRecord?.conflictJournal ?? []
        const before = conflictObjectCount(entries)
        const entry = latestEntry(entries, table, entityId)
        // 重复点击 / 条目已清 ⇒ 幂等 no-op
        if (!entry) return { ok: true, remaining: before }
        const cleared = entries.filter(
            (candidate) => candidate.table !== table || candidate.entityId !== entityId
        )
        // 非 `stale` 类型：语义**不变**（T640 Q3：`remote-wins` / `push-noop` 等仅清条目 ——
        //   本地已是胜方 / 内容相同 / 无法重放）；`stale` 才是 F-02 的真实写回路径
        if (entry.kind !== 'stale') {
            await localDatabase.meta.put({
                id: conflictJournalId(userId),
                conflictJournal: cleared,
                ...(metaRecord?.conflictJournalEvictedCount === undefined
                    ? {}
                    : { conflictJournalEvictedCount: metaRecord.conflictJournalEvictedCount })
            } satisfies MetaRecord)
            syncStatus.setConflictCount(conflictObjectCount(cleared))
            return { ok: true, remaining: conflictObjectCount(cleared) }
        }
        // 旧服务端降级：回执无 `serverCurrent` ⇒ 两态之「将在下次同步后生效」
        if (!entry.serverCurrent) {
            return {
                ok: false,
                remaining: before,
                pendingNextSync: true,
                error: 'pending-next-sync'
            }
        }
        if (!config) return { ok: false, remaining: before, error: 'unsupported' }
        // 例外③前置：**必须读本地当前行**（解密失败也要在这里被发现 ⇒ fail-soft）
        let currentRecord: Record<string, unknown> | undefined
        try {
            currentRecord = await config.getRecord(entityId)
            if (currentRecord) await config.recordToEntity(currentRecord)
        } catch {
            return { ok: false, remaining: before, error: 'decrypt-failed' }
        }
        const queued = await localDatabase.syncQueue.get(`${userId}:${table}:${entityId}`)
        const evictedCount = metaRecord?.conflictJournalEvictedCount
        // 例外②：删除中 ⇒ 不复活（不动行），保留删除意图，条目清（删除优先）
        //   ⚠️ 必须先于例外①：删除也是一次本地新写入（`localUpdatedAt` > 条目 `at`），但它不是「新编辑」
        const deleting = queued?.action === 'delete' || (currentRecord?.deletedAt ?? null) !== null
        if (deleting) {
            await localDatabase.meta.put({
                id: conflictJournalId(userId),
                conflictJournal: cleared,
                ...(evictedCount === undefined ? {} : { conflictJournalEvictedCount: evictedCount })
            } satisfies MetaRecord)
            syncStatus.setConflictCount(conflictObjectCount(cleared))
            return { ok: true, remaining: conflictObjectCount(cleared) }
        }
        // 例外①：记账之后本地又有新编辑 ⇒ 不静默丢新编辑
        if (queued && (Date.parse(queued.localUpdatedAt) || 0) > (Date.parse(entry.at) || 0)) {
            return { ok: false, remaining: before, error: 'local-edited' }
        }
        const serverUpdatedAt =
            typeof entry.serverCurrent.updatedAt === 'string'
                ? entry.serverCurrent.updatedAt
                : entry.winnerUpdatedAt
        const currentBase =
            typeof currentRecord?.syncedServerUpdatedAt === 'string'
                ? currentRecord.syncedServerUpdatedAt
                : undefined
        // 例外④：快照已过期 ⇒ base 只前进不回退（不得用旧快照覆盖本地）
        if (
            serverUpdatedAt &&
            currentBase &&
            (Date.parse(currentBase) || 0) > (Date.parse(serverUpdatedAt) || 0)
        ) {
            return { ok: false, remaining: before, error: 'snapshot-expired' }
        }
        // 正常路径：服务端行写回本地 + 保留新 base + 清队列/条目（单 Dexie 事务）
        // A2（DEF-132）：⛔ 不得把 raw `serverCurrent` 直接喂 `entityToRecord` —— 服务端行含
        //   `null` 数组 / `''` 空串哨兵（真服务端实测：`remindWeekdays: null` / `tags: null`），
        //   而 `taskEntityToRecord` / `taskCommentEntityToRecord` 会对数组做展开 ⇒ TypeError。
        //   ⇒ 必须先走**与 pull 同一条归一链**（`resToEntity` → `entityToRecord`）。
        let record: Record<string, unknown>
        try {
            const entity = config.resToEntity(entry.serverCurrent) as unknown as Record<
                string,
                unknown
            >
            // 与 pull 落库边界一致：服务端隐式桶（`userId`）⇒ 本地字面 `'inbox'`（R-5 / T188）
            if (table === 'tasks') {
                entity.projectId = toLocalProjectId(entity.projectId, userId)
            }
            record = (await config.entityToRecord(entity, userId)) as Record<string, unknown>
        } catch {
            // 例外③：解密/转换失败 ⇒ fail-soft（不改行 + 不清条目 + 可见失败）
            return { ok: false, remaining: before, error: 'decrypt-failed' }
        }
        // A6：`icon` 为「仅本机」字段（服务端不承载）⇒ 写回时保留本地图标，不被快照重置
        if (
            (table === 'projects' || table === 'tags') &&
            typeof currentRecord?.icon === 'string' &&
            currentRecord.icon !== ''
        ) {
            record.icon = currentRecord.icon
        }
        if (serverUpdatedAt) record.syncedServerUpdatedAt = serverUpdatedAt
        await localDatabase.transaction(
            'rw',
            config.rawTable,
            localDatabase.syncQueue,
            localDatabase.meta,
            async () => {
                await config.rawTable.put(record)
                await localDatabase.syncQueue.delete(`${userId}:${table}:${entityId}`)
                await localDatabase.meta.put({
                    id: conflictJournalId(userId),
                    conflictJournal: cleared,
                    ...(evictedCount === undefined
                        ? {}
                        : { conflictJournalEvictedCount: evictedCount })
                } satisfies MetaRecord)
            }
        )
        syncStatus.setConflictCount(conflictObjectCount(cleared))
        return { ok: true, remaining: conflictObjectCount(cleared) }
    })
}

/**
 * 恢复动作 B「以我的版本重试」：败方快照写回本地表（`updatedAt` = 服务端校准 now）+ `markDirty`
 * ⇒ 下轮 push 以**新 base**（当前服务端版本）重推；仍不匹配 ⇒ 再次 journal（不死循环）
 * @description 缺「表名 → 本地表/转换器」映射 ⇒ 显式失败（`ok:false`）且**不吞条目**（`remaining` = 现有**对象数**）；
 *              成功后删除该实体**全部** journal 条目（动作 A/B 对称）。
 */
export const resolveConflictRetryLocal = async (
    userId: string,
    table: string,
    entityId: string
): Promise<ConflictResolutionResult> => {
    if (!userId) return { ok: false, remaining: 0 }
    let resolved = false
    // 读-改-写同在 journal 锁内（含败方写回本地表的 `putRecord`/`markDirty`）⇒
    // 与后台 `appendConflict` 并发不丢条目（ADR §9.3）；无映射/条目不适用 ⇒ `null` ⇒ 不落盘
    const next = await withJournalRmw(userId, async ({ entries }) => {
        const config = findConflictEntity(table)
        const entry = config ? latestEntry(entries, table, entityId) : undefined
        if (!config || !entry || !RETRY_SNAPSHOT_KINDS.has(entry.kind)) return null
        // 败方作为一次**新的本地写**：`updatedAt` = 服务端校准 now；`putRecordAndEnqueue` 保留当前 base，
        // 且业务行 + 入队**同一 Dexie 事务**（T329 / DEF-50：⛔ 不得拆为两次 await ⇒ 防 RC-5 静默丢写）
        const updatedAt = nowCalibratedIso()
        const record = await config.entityToRecord({ ...entry.loser, updatedAt }, userId)
        await config.putRecordAndEnqueue(record, updatedAt)
        resolved = true
        return {
            entries: entries.filter(
                (candidate) => candidate.table !== table || candidate.entityId !== entityId
            )
        }
    })
    // T331/T346：成功恢复 ⇒ 同源刷新状态面计数（`remaining` = 剩余**对象数**）⇒ 徽标递减 / 归零
    if (resolved) syncStatus.setConflictCount(conflictObjectCount(next))
    return { ok: resolved, remaining: conflictObjectCount(next) }
}
// ---------------------------------------------------------------------------
// T643 / AC9 —— 冲突记录可观测：按类型 / 表 / 时段统计 + 导出
// 口径（PM 冻结形状 2026-11-03）：`byDay` 按 **UTC 日桶**（`YYYY-MM-DD`，空桶不补零）；
// `range` 为 **ISO 闭区间**；用户取自当前会话（`localSession`）。
// ---------------------------------------------------------------------------

/** 统计时段（ISO 闭区间；缺省 ⇒ 全部） */
export interface ConflictSummaryRange {
    from: string
    to: string
}

/** 按日统计桶（UTC 日期 `YYYY-MM-DD`） */
export interface ConflictDayBucket {
    date: string
    count: number
}

/** 冲突统计结果 */
export interface ConflictSummary {
    total: number
    byKind: Record<string, number>
    byTable: Record<string, number>
    byDay: ConflictDayBucket[]
}

/** 冲突导出载荷（**对象**；UI 侧自行 `JSON.stringify` 下载） */
export interface ConflictExport {
    version: 1
    exportedAt: string
    entries: ConflictJournalEntry[]
}

/** 当前会话用户（无会话 ⇒ 空串；用于无参统计 API） */
const sessionUserId = (): string => localSession.getCurrentUserId() ?? ''

/**
 * 冲突记录统计（按类型 / 表 / 时段）
 * @param range ISO 闭区间（`from`/`to` 任一非法 ⇒ 退化为不按该边界过滤）
 */
export const summarizeConflicts = async (
    range?: ConflictSummaryRange
): Promise<ConflictSummary> => {
    const userId = sessionUserId()
    if (!userId) return { total: 0, byKind: {}, byTable: {}, byDay: [] }
    const from = range ? Date.parse(range.from) : Number.NaN
    const to = range ? Date.parse(range.to) : Number.NaN
    const hasFrom = Number.isFinite(from)
    const hasTo = Number.isFinite(to)
    const byKind: Record<string, number> = {}
    const byTable: Record<string, number> = {}
    const byDayMap = new Map<string, number>()
    let total = 0
    for (const entry of await loadConflictJournal(userId)) {
        const at = Date.parse(entry.at)
        if (hasFrom && at < from) continue
        if (hasTo && at > to) continue
        total += 1
        byKind[entry.kind] = (byKind[entry.kind] ?? 0) + 1
        byTable[entry.table] = (byTable[entry.table] ?? 0) + 1
        const date = new Date(at).toISOString().slice(0, 10)
        byDayMap.set(date, (byDayMap.get(date) ?? 0) + 1)
    }
    const byDay = [...byDayMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, count]) => ({ date, count }))
    return { total, byKind, byTable, byDay }
}

/** 导出冲突记录（含败方内容；R-B：可恢复线索，而非只留一句文案） */
export const exportConflicts = async (): Promise<ConflictExport> => {
    const userId = sessionUserId()
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        entries: userId ? await loadConflictJournal(userId) : []
    }
}