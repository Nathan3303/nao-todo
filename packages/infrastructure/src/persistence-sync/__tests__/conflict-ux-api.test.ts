// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import {
    localDatabase,
    type ConflictJournalEntry,
    type MetaRecord
} from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import {
    CONFLICT_FOLD_HINT_THRESHOLD,
    CONFLICT_JOURNAL_LIMIT,
    type ConflictListResult,
    appendConflict,
    compareConflict,
    conflictJournalId,
    listConflicts,
    loadConflictJournal,
    resolveConflictKeepServer,
    resolveConflictRetryLocal
} from '../conflict-journal'

/**
 * T162b 用例先行（红基线）—— 阶段二 2B · 面 ③ 冲突 UX **API 数据面**（T165 第一段契约）
 *
 * 契约真源：ADR §9.2（冲突 UX）+ PM 裁定（T162b 派发第 2/3 条）。API 面已由 T165 第一段
 * （commit `571e924f`）冻结：`listConflicts` / `compareConflict` / `resolveConflictKeepServer` /
 * `resolveConflictRetryLocal` + `CONFLICT_FOLD_HINT_THRESHOLD`。
 *
 * 覆盖 5 面（红/绿分列见回执）：
 * ① `listConflicts` 顺序 + `loser` 快照语义（仅 remote-wins/push-noop/stale 有值）—— 现状**绿**；
 * ② `compareConflict` diffs / 本地行缺失 `current:null` / 无条目 `null` —— 占位实现 ⇒ **红**；
 * ③ `folded` 两情形：达阈值(200) ⇒ folded（绿）；**曾淘汰**（`conflictJournalEvictedCount>0`）⇒ folded
 *    —— 计数器未实现 ⇒ **红**（两情形**分列用例**，以便区分「已达上限」与「更早已折叠/丢弃」信号）；
 * ④ `resolveConflictKeepServer` 清实体全部条目 + `remaining` —— 现状**绿**；
 * ⑤ `resolveConflictRetryLocal` 败方写回 + `markDirty` + 保留新 base（不死循环）+ 无映射**显式失败**
 *    —— 占位实现 ⇒ **红**。
 *
 * ⚠️ 边界：本文件**只读** `conflict-journal.ts` 导出面（不碰实现，实现属 `rd-fe-T164`）。
 * ⚠️ `conflictJournalEvictedCount` 属**未落地**契约 ⇒ 经 `MetaWithEvictedCount` 类型扩展访问，
 *    不修改 `MetaRecord`（避免与实现方冲突 / 不臆造已冻结类型）。
 *
 * **T162c（PM 裁定，additive）**：
 * ① `ConflictListResult` 增 `foldedReason: 'limit' | 'evicted' | null`（未落地 ⇒ 经类型扩展访问）；
 * ② 动作 B 成功 ⇒ **删除该实体全部条目** + `remaining` = 删除后剩余；
 * ③ 动作 B 失败 ⇒ `remaining` = 现有条数（不吞条目；已由「无映射」用例覆盖）。
 */

const USER_ID = 'conflict-ux-api-user'
const SERVER_BASE = '2026-01-05T00:00:00.000Z'

/** 未落地契约：`meta` 纯追加淘汰计数器（T162b 第 3 条 PM 裁定） */
type MetaWithEvictedCount = MetaRecord & { conflictJournalEvictedCount?: number }

/** T162c 裁定：`foldedReason` 为 additive 契约（实现未落地 ⇒ 经类型扩展访问，不臆造已冻结类型） */
type FoldedReason = 'limit' | 'evicted' | null
const foldedReasonOf = (result: ConflictListResult): FoldedReason | undefined =>
    (result as unknown as { foldedReason?: FoldedReason }).foldedReason

const setup = async (): Promise<void> => {
    await localDatabase.projects.clear()
    await localDatabase.projectPreferences.clear()
    await localDatabase.tags.clear()
    await localDatabase.tagPreferences.clear()
    await localDatabase.tasks.clear()
    await localDatabase.taskCheckItems.clear()
    await localDatabase.taskComments.clear()
    await localDatabase.pomodoros.clear()
    await localDatabase.pomodoroRecords.clear()
    await localDatabase.users.clear()
    await localDatabase.userConfigs.clear()
    await localDatabase.meta.clear()
    await localDatabase.deletionSchedules.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

/** 建一条本地任务（胜方/当前行），返回其 id */
const createLocalTask = async (name: string): Promise<string> => {
    const repo = newLocalTaskRepository()
    const [task, taskErr] = await repo.create(
        new CreateTaskValueObject(
            null,
            null,
            name,
            '',
            'todo',
            'medium',
            null,
            null,
            'p-1',
            [],
            null,
            'none',
            null,
            []
        )
    )
    expect(taskErr).toBeNull()
    return (task as { id: string }).id
}

/** 读本地任务明文名（经仓储解密） */
const localTaskName = async (taskId: string): Promise<string | null> => {
    const [task] = await newLocalTaskRepository().get(taskId)
    return task === null ? null : (task as { name: string }).name
}

/** 取本地行明文快照（与 `sync-service` 记账 loser 同口径：`recordToEntity`） */
const plaintextSnapshot = async (taskId: string): Promise<Record<string, unknown>> => {
    const [task, taskErr] = await newLocalTaskRepository().get(taskId)
    expect(taskErr).toBeNull()
    return { ...(task as unknown as Record<string, unknown>) }
}

/** 构造一条 journal 条目（默认 remote-wins） */
const entry = (over: Partial<ConflictJournalEntry> = {}): ConflictJournalEntry => ({
    kind: 'remote-wins',
    table: 'tasks',
    entityId: 'e-1',
    loser: { id: 'e-1' },
    at: new Date().toISOString(),
    ...over
})

describe('面 ③ API - ① listConflicts：顺序 + loser 快照语义', () => {
    beforeEach(async () => {
        await setup()
    })

    it('items 按记账顺序（末尾最新）+ id 稳定；loser 仅 remote-wins/push-noop/stale 有值', async () => {
        const kinds: ConflictJournalEntry['kind'][] = [
            'remote-wins',
            'push-noop',
            'stale',
            'conflict',
            'skipped'
        ]
        for (const [i, kind] of kinds.entries()) {
            await appendConflict(USER_ID, {
                kind,
                table: 'tasks',
                entityId: `e-${i}`,
                loser: { id: `e-${i}`, name: `败方-${i}` }
            })
        }

        const result = await listConflicts(USER_ID)
        expect(result.items).toHaveLength(kinds.length)
        expect(result.folded).toBe(false)
        // 记账顺序：末尾最新
        expect(result.items.map((item) => item.kind)).toEqual(kinds)
        expect(result.items.map((item) => item.entityId)).toEqual(kinds.map((_, i) => `e-${i}`))
        // id 稳定且唯一（`${table}:${entityId}:${at}`）
        const ids = result.items.map((item) => item.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids[0]).toBe(`tasks:e-0:${result.items[0]!.at}`)
        // loser 快照：仅三种 kind 有值，conflict/skipped ⇒ null
        expect(result.items[0]!.loser).toEqual({ id: 'e-0', name: '败方-0' })
        expect(result.items[1]!.loser).toEqual({ id: 'e-1', name: '败方-1' })
        expect(result.items[2]!.loser).toEqual({ id: 'e-2', name: '败方-2' })
        expect(result.items[3]!.loser).toBeNull()
        expect(result.items[4]!.loser).toBeNull()
    })
})

describe('面 ③ API - ② compareConflict：diffs / current 缺失 / 无条目', () => {
    beforeEach(async () => {
        await setup()
    })

    it('无该条目 ⇒ null（不臆造"无冲突"结论）', async () => {
        expect(await compareConflict(USER_ID, 'tasks', 'not-journaled')).toBeNull()
    })

    it('返回逐字段 diffs（loser 快照 vs 本地当前行明文）；相等字段不入 diffs', async () => {
        const taskId = await createLocalTask('胜方名')
        const current = await plaintextSnapshot(taskId)
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: taskId,
            loser: { ...current, name: '败方名' },
            winnerUpdatedAt: SERVER_BASE
        })

        const comparison = await compareConflict(USER_ID, 'tasks', taskId)
        expect(comparison).not.toBeNull()
        expect(comparison!.table).toBe('tasks')
        expect(comparison!.entityId).toBe(taskId)
        expect((comparison!.loser as { name: string }).name).toBe('败方名')
        expect((comparison!.current as { name: string }).name).toBe('胜方名')
        // 字段级差异：name 有差异 ⇒ 必入 diffs
        const nameDiff = comparison!.diffs.find((diff) => diff.field === 'name')
        expect(nameDiff).toBeDefined()
        expect(nameDiff!.loser).toBe('败方名')
        expect(nameDiff!.current).toBe('胜方名')
        // 相等字段（priority）不得出现在 diffs（diffs = 差异）
        expect(comparison!.diffs.some((diff) => diff.field === 'priority')).toBe(false)
        expect(comparison!.diffs.every((diff) => diff.loser !== diff.current)).toBe(true)
    })

    it('本地当前行缺失 ⇒ current:null 且不抛错、不静默返回无冲突（diffs 以 null 呈现）', async () => {
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: 'missing-local-row',
            loser: { id: 'missing-local-row', name: '只剩败方' },
            winnerUpdatedAt: SERVER_BASE
        })

        const comparison = await compareConflict(USER_ID, 'tasks', 'missing-local-row')
        expect(comparison).not.toBeNull()
        expect(comparison!.current).toBeNull()
        expect((comparison!.loser as { name: string }).name).toBe('只剩败方')
        const nameDiff = comparison!.diffs.find((diff) => diff.field === 'name')
        expect(nameDiff).toBeDefined()
        expect(nameDiff!.current).toBeNull()
    })
})

describe('面 ③ API - ③ folded：达阈值 vs 曾淘汰（两信号分列）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('① 条目数达 CONFLICT_FOLD_HINT_THRESHOLD(200) ⇒ folded=true（「已达上限」信号）', async () => {
        expect(CONFLICT_FOLD_HINT_THRESHOLD).toBe(200)
        for (let i = 0; i < CONFLICT_FOLD_HINT_THRESHOLD; i += 1) {
            await appendConflict(USER_ID, {
                kind: 'remote-wins',
                table: 'tasks',
                entityId: `t-${i}`,
                loser: { id: `t-${i}` }
            })
        }

        const result = await listConflicts(USER_ID)
        expect(result.items).toHaveLength(CONFLICT_FOLD_HINT_THRESHOLD)
        expect(result.folded).toBe(true)
        // 达上限但尚未淘汰 ⇒ 计数器仍为 0（与「曾淘汰」信号可区分）
        const record = (await localDatabase.meta.get(conflictJournalId(USER_ID))) as
            | MetaWithEvictedCount
            | undefined
        expect(record?.conflictJournalEvictedCount ?? 0).toBe(0)
    })

    it('② 曾淘汰过（conflictJournalEvictedCount>0）⇒ folded=true（「更早已折叠/丢弃」信号）—— 计数器未实现 ⇒ 红', async () => {
        const seeded: MetaWithEvictedCount = {
            id: conflictJournalId(USER_ID),
            conflictJournal: [entry({ entityId: 't-kept' })],
            conflictJournalEvictedCount: 7
        }
        await localDatabase.meta.put(seeded)

        const result = await listConflicts(USER_ID)
        expect(result.items).toHaveLength(1)
        expect(result.folded).toBe(true)
    })

    it('② 淘汰计数器为纯追加：写满 205 条 ⇒ 计数器 = 5 —— 未实现 ⇒ 红', async () => {
        const total = CONFLICT_JOURNAL_LIMIT + 5
        for (let i = 0; i < total; i += 1) {
            await appendConflict(USER_ID, {
                kind: 'remote-wins',
                table: 'tasks',
                entityId: `t-${i}`,
                loser: { id: `t-${i}` }
            })
        }

        expect(await loadConflictJournal(USER_ID)).toHaveLength(CONFLICT_JOURNAL_LIMIT)
        const record = (await localDatabase.meta.get(conflictJournalId(USER_ID))) as
            | MetaWithEvictedCount
            | undefined
        expect(record?.conflictJournalEvictedCount).toBe(5)
    })

    it('① foldedReason 三态：达 200 ⇒ limit · 曾淘汰 ⇒ evicted · 皆否 ⇒ null（additive 契约未实现 ⇒ 红）', async () => {
        // 皆否（1 条，未达阈值、未淘汰）
        await localDatabase.meta.put({
            id: conflictJournalId(USER_ID),
            conflictJournal: [entry({ entityId: 'r-below' })]
        } satisfies MetaRecord)
        const below = await listConflicts(USER_ID)
        expect(below.folded).toBe(false)
        expect(foldedReasonOf(below)).toBeNull()

        // 达上限（200 条，未淘汰）
        await localDatabase.meta.put({
            id: conflictJournalId(USER_ID),
            conflictJournal: Array.from({ length: CONFLICT_FOLD_HINT_THRESHOLD }, (_, i) =>
                entry({ entityId: `r-${i}` })
            )
        } satisfies MetaRecord)
        const atLimit = await listConflicts(USER_ID)
        expect(atLimit.folded).toBe(true)
        expect(foldedReasonOf(atLimit)).toBe('limit')

        // 曾淘汰（1 条 + 计数器 > 0）
        const evictedRecord: MetaWithEvictedCount = {
            id: conflictJournalId(USER_ID),
            conflictJournal: [entry({ entityId: 'r-evicted' })],
            conflictJournalEvictedCount: 3
        }
        await localDatabase.meta.put(evictedRecord)
        const evicted = await listConflicts(USER_ID)
        expect(evicted.folded).toBe(true)
        expect(foldedReasonOf(evicted)).toBe('evicted')
    })
})

describe('面 ③ API - ④ resolveConflictKeepServer：清实体全部条目', () => {
    beforeEach(async () => {
        await setup()
    })

    it('清该实体全部 journal 条目 + remaining=剩余条数（已实现 ⇒ 绿）', async () => {
        await appendConflict(USER_ID, {
            kind: 'remote-wins',
            table: 'tasks',
            entityId: 'A',
            loser: { id: 'A', name: '败方 A1' }
        })
        await appendConflict(USER_ID, {
            kind: 'push-noop',
            table: 'tasks',
            entityId: 'A',
            loser: { id: 'A', name: '败方 A2' }
        })
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: 'B',
            loser: { id: 'B', name: '败方 B' }
        })

        const result = await resolveConflictKeepServer(USER_ID, 'tasks', 'A')
        expect(result.ok).toBe(true)
        expect(result.remaining).toBe(1)
        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(1)
        expect(entries[0]!.entityId).toBe('B')
        // 动作 A 不重推、不覆盖本地（不写业务 syncQueue）
        expect(await localDatabase.syncQueue.count()).toBe(0)
    })
})

describe('面 ③ API - ⑤ resolveConflictRetryLocal：写回 + markDirty + 新 base + 无映射显式失败', () => {
    beforeEach(async () => {
        await setup()
    })

    it('把败方写回本地 + 入队 + 保留当前 base（以新 base 重推，不死循环）—— 占位实现 ⇒ 红', async () => {
        const taskId = await createLocalTask('胜方名')
        const current = await plaintextSnapshot(taskId)
        // 模拟 OCC 已建立 base（当前服务端版本）⇒ 重推必须沿用该 base
        await localDatabase.tasks.update(taskId, { syncedServerUpdatedAt: SERVER_BASE })
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: taskId,
            loser: { ...current, name: '败方名' },
            winnerUpdatedAt: SERVER_BASE
        })

        const result = await resolveConflictRetryLocal(USER_ID, 'tasks', taskId)
        expect(result.ok).toBe(true)
        // 败方写回本地（明文可读）
        expect(await localTaskName(taskId)).toBe('败方名')
        // markDirty（入队）：恰好一条 tasks 项，upsert
        const queued = await localDatabase.syncQueue
            .where('userId')
            .equals(USER_ID)
            .filter((record) => record.table === 'tasks' && record.entityId === taskId)
            .toArray()
        expect(queued).toHaveLength(1)
        expect(queued[0]!.action).toBe('upsert')
        // 以新 base 重推（R-20 灾难路径守护）：base 未被清空/未被败方旧时间覆盖
        const record = await localDatabase.tasks.get(taskId)
        expect(record?.syncedServerUpdatedAt).toBe(SERVER_BASE)
    })

    it('动作 B 成功 ⇒ 删除该实体**全部** journal 条目 + remaining=删除后剩余（PM T162c 裁定）—— 未实现 ⇒ 红', async () => {
        const taskId = await createLocalTask('胜方名')
        const current = await plaintextSnapshot(taskId)
        await localDatabase.tasks.update(taskId, { syncedServerUpdatedAt: SERVER_BASE })
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: taskId,
            loser: { ...current, name: '败方名1' },
            winnerUpdatedAt: SERVER_BASE
        })
        await appendConflict(USER_ID, {
            kind: 'push-noop',
            table: 'tasks',
            entityId: taskId,
            loser: { ...current, name: '败方名2' },
            winnerUpdatedAt: SERVER_BASE
        })
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: 'other-entity',
            loser: { id: 'other-entity', name: '别实体败方' }
        })

        const result = await resolveConflictRetryLocal(USER_ID, 'tasks', taskId)
        expect(result.ok).toBe(true)
        // 该实体全部条目已删除 ⇒ remaining = 删除后剩余（仅别实体 1 条）
        expect(result.remaining).toBe(1)
        const remaining = await loadConflictJournal(USER_ID)
        expect(remaining).toHaveLength(1)
        expect(remaining[0]!.entityId).toBe('other-entity')
    })

    it('无 table→repo/转换器 映射 ⇒ 明确失败（ok:false）且**保留**条目、不写队列（含 ③ remaining=现有条数）—— 现状吞条目 ⇒ 红', async () => {
        await appendConflict(USER_ID, {
            kind: 'remote-wins',
            table: 'unknown-table',
            entityId: 'x-1',
            loser: { id: 'x-1', name: '不可映射的败方' }
        })

        const result = await resolveConflictRetryLocal(USER_ID, 'unknown-table', 'x-1')
        expect(result.ok).toBe(false)
        expect(await localDatabase.syncQueue.count()).toBe(0)
        // 失败不得吞掉条目：remaining = 现有条数（1），条目仍在
        expect(result.remaining).toBe(1)
        expect(await loadConflictJournal(USER_ID)).toHaveLength(1)
    })
})