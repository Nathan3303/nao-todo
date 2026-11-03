// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
    localDatabase,
    type ConflictJournalEntry,
    type MetaRecord
} from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { conflictJournalId } from '../conflict-journal'

/**
 * T641 / `AC9`（可观测）用例先行（红基线）—— 冲突记录**可按类型 / 表 / 时段统计并可导出**
 *
 * 契约真源：PRD §六 NFR「可观测」· AC9 · **PM 冻结形状（2026-11-03，T641 轮次 1 验收后）**：
 * - `summarizeConflicts(range?: { from: string; to: string })` ⇒
 *   `{ total, byKind: Record<string,number>, byTable: Record<string,number>,
 *      byDay: Array<{ date: string; count: number }> }`
 *   （`byDay` 按 **UTC 日桶** `YYYY-MM-DD`；`range` 为 **ISO 闭区间**；用户取自当前会话）
 * - `exportConflicts()` ⇒ **`ConflictExport` 对象**（**不返回字符串** —— UI 侧自行 `JSON.stringify` 下载）：
 *   `{ version: 1; exportedAt: string; entries: ConflictJournalEntry[] }`。
 *
 * 现状**红**：两函数均未导出（用**动态 import + typeof 守门**，避免红基线破坏 `vp check` 类型面）。
 */

const USER_ID = 't641-ac9-user'
type JournalKind = ConflictJournalEntry['kind']

const PULL_LOCAL_WINS = 'pull-local-wins' as unknown as JournalKind

const FIXTURE_ENTRIES: ConflictJournalEntry[] = [
    {
        kind: 'stale',
        table: 'tasks',
        entityId: 't1',
        loser: { id: 't1', name: '败方-t1' },
        at: '2026-11-01T10:00:00.000Z'
    },
    {
        kind: PULL_LOCAL_WINS,
        table: 'tasks',
        entityId: 't1',
        loser: { id: 't1', name: '败方-t1-远端' },
        at: '2026-11-01T11:00:00.000Z'
    },
    {
        kind: 'conflict',
        table: 'tasks',
        entityId: 't2',
        loser: { id: 't2', name: '败方-t2' },
        at: '2026-11-02T09:00:00.000Z'
    },
    {
        kind: 'remote-wins',
        table: 'projects',
        entityId: 'p1',
        loser: { id: 'p1', name: '败方-p1' },
        at: '2026-11-02T12:00:00.000Z'
    },
    {
        kind: 'skipped',
        table: 'tags',
        entityId: 'g1',
        loser: { id: 'g1', name: '败方-g1' },
        at: '2026-11-03T08:00:00.000Z'
    }
]

/** PM 冻结形状：统计结果 */
interface ConflictSummaryLike {
    total: number
    byKind: Record<string, number>
    byTable: Record<string, number>
    byDay: { date: string; count: number }[]
}

/** PM 冻结形状：导出对象（**不是字符串**） */
interface ConflictExportLike {
    version: 1
    exportedAt: string
    entries: ConflictJournalEntry[]
}

interface ConflictSummaryRange {
    from: string
    to: string
}

interface JournalStatsModule {
    summarizeConflicts?: (range?: ConflictSummaryRange) => Promise<ConflictSummaryLike>
    exportConflicts?: () => Promise<ConflictExportLike>
}

const loadStatsModule = async (): Promise<JournalStatsModule> =>
    (await import('../conflict-journal')) as unknown as JournalStatsModule

const seedJournal = async (): Promise<void> => {
    await localDatabase.meta.put({
        id: conflictJournalId(USER_ID),
        conflictJournal: FIXTURE_ENTRIES
    } satisfies MetaRecord)
}

describe('T641 / AC9 冲突记录统计与导出', () => {
    beforeEach(async () => {
        await localDatabase.meta.clear()
        await localDatabase.projects.clear()
        await localDatabase.tags.clear()
        await localDatabase.tasks.clear()
        localSession.setCurrentUserId(USER_ID)
        await seedJournal()
    })

    it('AC9 按类型 / 表 / 时段统计（PM 冻结形状：byDay · UTC 日桶）', async () => {
        const mod = await loadStatsModule()
        expect(
            typeof mod.summarizeConflicts,
            'AC9 需要 summarizeConflicts(range?: { from, to })（PM 冻结形状）'
        ).toBe('function')
        if (typeof mod.summarizeConflicts !== 'function') return

        const stats = await mod.summarizeConflicts()

        expect(stats.total).toBe(5)
        // 按类型（含本批新 kind）
        expect(stats.byKind).toMatchObject({
            stale: 1,
            'pull-local-wins': 1,
            conflict: 1,
            'remote-wins': 1,
            skipped: 1
        })
        // 按表
        expect(stats.byTable).toMatchObject({ tasks: 3, projects: 1, tags: 1 })
        // 按时段（`byDay`；UTC 日桶；空桶不补零）
        expect(stats.byDay).toEqual([
            { date: '2026-11-01', count: 2 },
            { date: '2026-11-02', count: 2 },
            { date: '2026-11-03', count: 1 }
        ])
    })

    it('AC9 时段过滤（ISO 闭区间）⇒ 只统计区间内记录', async () => {
        const mod = await loadStatsModule()
        if (typeof mod.summarizeConflicts !== 'function') {
            expect(typeof mod.summarizeConflicts).toBe('function')
            return
        }

        const stats = await mod.summarizeConflicts({
            from: '2026-11-02T00:00:00.000Z',
            to: '2026-11-02T23:59:59.999Z'
        })

        expect(stats.total).toBe(2)
        expect(stats.byKind).toMatchObject({ conflict: 1, 'remote-wins': 1 })
        expect(stats.byTable).toMatchObject({ tasks: 1, projects: 1 })
        expect(stats.byDay).toEqual([{ date: '2026-11-02', count: 2 }])
    })

    it('AC9 可导出：返回 ConflictExport 对象（version/exportedAt/entries，含败方内容；不是字符串）', async () => {
        const mod = await loadStatsModule()
        expect(
            typeof mod.exportConflicts,
            'AC9 需要 exportConflicts() => ConflictExport 对象（PM 冻结形状：不由函数返回字符串）'
        ).toBe('function')
        if (typeof mod.exportConflicts !== 'function') return

        const exported = await mod.exportConflicts()

        // ⛔ 不得直接返回字符串（UI 侧自行 JSON.stringify 下载）
        expect(typeof exported).toBe('object')
        expect(exported.version).toBe(1)
        expect(Number.isNaN(Date.parse(exported.exportedAt))).toBe(false)
        expect(exported.entries).toHaveLength(5)
        expect(exported.entries.map((entry) => entry.entityId).sort()).toEqual([
            'g1',
            'p1',
            't1',
            't1',
            't2'
        ])
        // 导出必须含**败方内容**（R-B：可恢复线索，而非只留一句文案）
        expect(JSON.stringify(exported)).toContain('败方-t1')
    })
})