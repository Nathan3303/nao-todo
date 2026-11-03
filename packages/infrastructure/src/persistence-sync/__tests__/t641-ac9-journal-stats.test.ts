// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
    localDatabase,
    type ConflictJournalEntry,
    type MetaRecord
} from '../../persistence-local/db/local-database'
import { conflictJournalId } from '../conflict-journal'

/**
 * T641 / `AC9`（可观测）用例先行（红基线）—— 冲突记录**可按类型 / 表 / 时段统计并可导出**
 *
 * 契约真源：PRD §六 NFR「可观测」· AC9（「冲突记录必须可按类型 / 表 / 时段统计且能被导出；
 *          默认只在本机统计，不做网络上报」）。
 *
 * ⚠️ **形状待实现确认**：AC9 只规定能力，未冻结函数名/返回形状。本用例先写期望形状：
 * - `summarizeConflicts(userId, { from?, to?, bucket?: 'day' }) =>
 *     { total, byKind, byTable, byPeriod: { period, count }[] }`
 *   （时段口径：`at` 按 **ISO 闭区间**过滤；`period` 桶 = UTC 日 `YYYY-MM-DD`）
 * - `exportConflicts(userId, { from?, to? }) => Promise<string>`，JSON 文本含
 *   `{ total, byKind, byTable, byPeriod, entries }`（本机导出，无网络）。
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

interface ConflictStatsLike {
    total: number
    byKind: Record<string, number>
    byTable: Record<string, number>
    byPeriod: { period: string; count: number }[]
}

interface ConflictStatsOptions {
    from?: string
    to?: string
    bucket?: 'day'
}

interface JournalStatsModule {
    summarizeConflicts?: (
        userId: string,
        options?: ConflictStatsOptions
    ) => Promise<ConflictStatsLike>
    exportConflicts?: (userId: string, options?: ConflictStatsOptions) => Promise<string>
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
        await seedJournal()
    })

    it('AC9 按类型 / 表 / 时段统计（形状待实现确认）', async () => {
        const mod = await loadStatsModule()
        expect(
            typeof mod.summarizeConflicts,
            'AC9 需要 summarizeConflicts(userId, { from?, to?, bucket? })（形状待实现确认）'
        ).toBe('function')
        if (typeof mod.summarizeConflicts !== 'function') return

        const stats = await mod.summarizeConflicts(USER_ID, { bucket: 'day' })

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
        // 按时段（UTC 日桶；空桶不补零）
        expect(stats.byPeriod).toEqual([
            { period: '2026-11-01', count: 2 },
            { period: '2026-11-02', count: 2 },
            { period: '2026-11-03', count: 1 }
        ])
    })

    it('AC9 时段过滤（ISO 闭区间）⇒ 只统计区间内记录', async () => {
        const mod = await loadStatsModule()
        if (typeof mod.summarizeConflicts !== 'function') {
            expect(typeof mod.summarizeConflicts).toBe('function')
            return
        }

        const stats = await mod.summarizeConflicts(USER_ID, {
            from: '2026-11-02T00:00:00.000Z',
            to: '2026-11-02T23:59:59.999Z',
            bucket: 'day'
        })

        expect(stats.total).toBe(2)
        expect(stats.byKind).toMatchObject({ conflict: 1, 'remote-wins': 1 })
        expect(stats.byTable).toMatchObject({ tasks: 1, projects: 1 })
        expect(stats.byPeriod).toEqual([{ period: '2026-11-02', count: 2 }])
    })

    it('AC9 可导出（JSON 文本；含败方内容；本机导出无网络上报）', async () => {
        const mod = await loadStatsModule()
        expect(
            typeof mod.exportConflicts,
            'AC9 需要 exportConflicts(userId, { from?, to? }) => Promise<string>（形状待实现确认）'
        ).toBe('function')
        if (typeof mod.exportConflicts !== 'function') return

        const exported = await mod.exportConflicts(USER_ID)
        expect(typeof exported).toBe('string')
        const parsed = JSON.parse(exported) as {
            total?: number
            entries?: unknown[]
            byKind?: Record<string, number>
            byTable?: Record<string, number>
            byPeriod?: unknown[]
        }
        expect(parsed.total).toBe(5)
        expect(parsed.entries).toHaveLength(5)
        expect(parsed.byKind).toMatchObject({ 'pull-local-wins': 1 })
        expect(parsed.byTable).toMatchObject({ tasks: 3 })
        expect(parsed.byPeriod).toHaveLength(3)
        // 导出必须含**败方内容**（R-B：可恢复线索，而非只留一句文案）
        expect(exported).toContain('败方-t1')
    })
})