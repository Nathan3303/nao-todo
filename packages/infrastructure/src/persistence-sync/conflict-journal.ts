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

export type { ConflictJournalEntry }

/** 每用户冲突记账上限（环形淘汰，保留最新） */
export const CONFLICT_JOURNAL_LIMIT = 50

/** 冲突记账在 `meta` 表中的主键后缀（非索引字段 ⇒ 不触 C-44） */
const CONFLICT_JOURNAL_SUFFIX = 'conflict-journal'

/** 某用户冲突记账在 `meta` 表中的主键 */
export const conflictJournalId = (userId: string): string => `${userId}:${CONFLICT_JOURNAL_SUFFIX}`

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
    const entries = await loadConflictJournal(userId)
    const entry: ConflictJournalEntry = {
        kind: input.kind,
        table: input.table,
        entityId: input.entityId,
        loser: input.loser,
        ...(input.winnerUpdatedAt === undefined ? {} : { winnerUpdatedAt: input.winnerUpdatedAt }),
        ...(input.loserUpdatedAt === undefined ? {} : { loserUpdatedAt: input.loserUpdatedAt }),
        at: new Date().toISOString()
    }
    const next = [...entries, entry].slice(-CONFLICT_JOURNAL_LIMIT)
    await localDatabase.meta.put({
        id: conflictJournalId(userId),
        conflictJournal: next
    } satisfies MetaRecord)
    return next.length
}

/** 清空冲突记账（登出/清库随 `meta` 一并清除；此处供显式清理） */
export const clearConflictJournal = async (userId: string): Promise<void> => {
    if (!userId) return
    await localDatabase.meta.delete(conflictJournalId(userId))
}