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
import { findConflictEntity } from './conflict-entity-registry'
import { nowCalibratedIso } from './sync-config'
import { syncTracker } from './sync-tracker'
import { logStructured, STRUCTURED_LOG_EVENTS } from '../observability/structured-log'

export type { ConflictJournalEntry }

/** 每用户冲突记账上限（环形淘汰，保留最新；DP-2B-5：50 → 200 + 折叠提示） */
export const CONFLICT_JOURNAL_LIMIT = 200

/** 冲突记账在 `meta` 表中的主键后缀（非索引字段 ⇒ 不触 C-44） */
const CONFLICT_JOURNAL_SUFFIX = 'conflict-journal'

/** 某用户冲突记账在 `meta` 表中的主键 */
export const conflictJournalId = (userId: string): string => `${userId}:${CONFLICT_JOURNAL_SUFFIX}`

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
}

/** 读取冲突记账（无记录 ⇒ 空数组；按记账顺序，末尾为最新） */
export const loadConflictJournal = async (userId: string): Promise<ConflictJournalEntry[]> => {
    if (!userId) return []
    const record = await localDatabase.meta.get(conflictJournalId(userId))
    return record?.conflictJournal ?? []
}

/** 冲突记账条数（冷启动恢复状态面计数用；无记录 ⇒ 0） */
export const countConflicts = async (userId: string): Promise<number> =>
    (await loadConflictJournal(userId)).length

/**
 * 追加一条冲突记账（**纯追加 + 有界**：超上限环形淘汰最旧）
 * @returns 追加后的记账条数（供状态面计数）
 * @description 空 `userId` 硬失败（C-55：不得退化为空用户读写）
 */
export const appendConflict = async (
    userId: string,
    input: ConflictJournalInput
): Promise<number> => {
    if (!userId) return 0
    // 跨路径互斥（ADR §9.3）：pull 的 remote-wins 与 push 的 stale/noop/... 均经本入口 ⇒
    // 同一 `meta` 单记录的 RMW 在 journal 锁内串行（锁序：pull/push 锁 → journal 锁，最内层）
    const next = await withJournalRmw(userId, ({ entries, record }) => {
        const entry: ConflictJournalEntry = {
            kind: input.kind,
            table: input.table,
            entityId: input.entityId,
            loser: input.loser,
            ...(input.winnerUpdatedAt === undefined
                ? {}
                : { winnerUpdatedAt: input.winnerUpdatedAt }),
            ...(input.loserUpdatedAt === undefined ? {} : { loserUpdatedAt: input.loserUpdatedAt }),
            at: new Date().toISOString()
        }
        const appended = [...entries, entry].slice(-CONFLICT_JOURNAL_LIMIT)
        // R-15：环形淘汰累计计数（与 journal 同一 meta 记录的**同一次** RMW ⇒ 无第二处写点）
        const evicted = entries.length + 1 - CONFLICT_JOURNAL_LIMIT
        return {
            entries: appended,
            evictedCount: (record?.conflictJournalEvictedCount ?? 0) + (evicted > 0 ? evicted : 0)
        }
    })
    return next.length
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

/** 有快照的冲突类型（`loser` = 被覆盖内容）；其余（`conflict`/`skipped`）无快照 */
const SNAPSHOT_KINDS: ReadonlySet<ConflictJournalEntry['kind']> = new Set([
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
    /** 动作后该用户 journal 剩余条数（供状态面计数刷新） */
    remaining: number
}

/** 冲突条目 → 列表项（UI 面） */
const toConflictListItem = (entry: ConflictJournalEntry): ConflictListItem => ({
    id: `${entry.table}:${entry.entityId}:${entry.at}`,
    kind: entry.kind,
    table: entry.table,
    entityId: entry.entityId,
    loser: SNAPSHOT_KINDS.has(entry.kind) ? entry.loser : null,
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

/** 逐字段差异（**仅差异**入列；任一侧缺失时以 `null` 呈现） */
const diffFields = (
    loser: Record<string, unknown> | null,
    current: Record<string, unknown> | null
): ConflictFieldDiff[] => {
    const fields = new Set([...Object.keys(loser ?? {}), ...Object.keys(current ?? {})])
    const diffs: ConflictFieldDiff[] = []
    for (const field of fields) {
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
    const loser = SNAPSHOT_KINDS.has(entry.kind) ? entry.loser : null
    const config = findConflictEntity(table)
    let current: Record<string, unknown> | null = null
    if (config) {
        const record = await config.getRecord(entityId)
        if (record) current = await config.recordToEntity(record)
    }
    return { table, entityId, loser, current, diffs: diffFields(loser, current) }
}

/**
 * 恢复动作 A「保留服务端版本」：清除该实体的 journal 条目（本地已是胜方，无副作用）
 * @returns `remaining` = 清除后剩余条数（供状态面计数刷新）
 */
export const resolveConflictKeepServer = async (
    userId: string,
    table: string,
    entityId: string
): Promise<ConflictResolutionResult> => {
    if (!userId) return { ok: true, remaining: 0 }
    // 读-改-写同在 journal 锁内 ⇒ 与后台 `appendConflict` 并发不丢条目（ADR §9.3）
    const next = await withJournalRmw(userId, ({ entries }) => {
        const remaining = entries.filter(
            (entry) => entry.table !== table || entry.entityId !== entityId
        )
        return remaining.length === entries.length ? null : { entries: remaining }
    })
    return { ok: true, remaining: next.length }
}

/**
 * 恢复动作 B「以我的版本重试」：败方快照写回本地表（`updatedAt` = 服务端校准 now）+ `markDirty`
 * ⇒ 下轮 push 以**新 base**（当前服务端版本）重推；仍不匹配 ⇒ 再次 journal（不死循环）
 * @description 缺「表名 → 本地表/转换器」映射 ⇒ 显式失败（`ok:false`）且**不吞条目**（`remaining` = 现有条数）；
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
        if (!config || !entry || !SNAPSHOT_KINDS.has(entry.kind)) return null
        // 败方作为一次**新的本地写**：`updatedAt` = 服务端校准 now；`putRecord` 保留当前 base
        const updatedAt = nowCalibratedIso()
        const record = await config.entityToRecord({ ...entry.loser, updatedAt }, userId)
        await config.putRecord(record)
        await syncTracker.markDirty(table, entityId, 'upsert', updatedAt)
        resolved = true
        return {
            entries: entries.filter(
                (candidate) => candidate.table !== table || candidate.entityId !== entityId
            )
        }
    })
    return { ok: resolved, remaining: next.length }
}