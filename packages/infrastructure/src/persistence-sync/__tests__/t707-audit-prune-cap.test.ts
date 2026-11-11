// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { readStructuredLog } from '../../observability/structured-log'
import {
    AUDIT_LIMIT,
    AUDIT_PRUNE_CHUNK_SIZE,
    AUDIT_PRUNE_MAX_PER_RUN,
    clearAudit,
    countAudit,
    pruneAuditLog
} from '../audit-log'
import { USER_ID, requireAuditTable, resetAuditState } from './t697-audit-harness'

/**
 * `T707` · 修复项 2 的**永久守卫**：裁切**每次调度限幅 + 分块删除**
 *
 * @description 背景（`T706` 实测）：一次性裁切 1000 条 ≈3.7s、2000 条 ≈10.5s（伪 IndexedDB），
 *              单次 `update` 首次 max 823ms ⇒ 事件循环被巨型删除占满。修法 = 每次调度最多删
 *              `AUDIT_PRUNE_MAX_PER_RUN`（400）条，按 ≤`AUDIT_PRUNE_CHUNK_SIZE`（200）分块；
 *              剩余留给**下一次调度**（⛔ 不为清空而 await 死循环）。
 * @see docs/reports/346-audit-log-red-baseline.md（`T706` 复核 §性能）
 */

const isoDaysAgo = (days: number, offsetMs = 0): string =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000 + offsetMs).toISOString()

const seedAuditRows = async (count: number, at: (index: number) => string): Promise<void> => {
    const rows = Array.from({ length: count }, (_, index) => ({
        userId: USER_ID,
        entity: 'tasks',
        entityId: `t707-seeded-${index}`,
        action: 'update' as const,
        source: 'local-edit' as const,
        fields: [],
        at: at(index)
    }))
    await requireAuditTable().bulkAdd(rows as never[])
}

const evictedEvents = (): Array<{ count: number; durationMs: number }> =>
    readStructuredLog()
        .filter((entry) => String(entry.event) === 'audit.entry.evicted')
        .map((entry) => ({
            count: Number(entry.fields.count ?? 0),
            durationMs: Number(entry.fields.durationMs ?? -1)
        }))

describe('T707 / 裁切限幅与分块', () => {
    beforeEach(resetAuditState)

    it('严重溢出（1200 条过期）⇒ 单次调度最多删 400 条，剩余留给后续调度', async () => {
        await seedAuditRows(1200, (index) => isoDaysAgo(200, index * 1000))
        expect(await countAudit()).toBe(1200)

        const firstRun = await pruneAuditLog(USER_ID)

        // ① 限幅：单次调度不超过上限
        expect(firstRun, `单次裁切不得超过 ${AUDIT_PRUNE_MAX_PER_RUN} 条`).toBeLessThanOrEqual(
            AUDIT_PRUNE_MAX_PER_RUN
        )
        expect(firstRun).toBe(AUDIT_PRUNE_MAX_PER_RUN)
        // ② 剩余量仍在（不为清空而死循环）
        expect(await countAudit()).toBe(1200 - AUDIT_PRUNE_MAX_PER_RUN)

        // ③ 下一次调度继续清（功能不丢）
        const secondRun = await pruneAuditLog(USER_ID)
        expect(secondRun).toBe(AUDIT_PRUNE_MAX_PER_RUN)
        expect(await countAudit()).toBe(1200 - AUDIT_PRUNE_MAX_PER_RUN * 2)

        // ④ 观测：每次调度各一条事件，只含条数与耗时（不含业务值）
        const events = evictedEvents()
        expect(events.map((event) => event.count)).toEqual([
            AUDIT_PRUNE_MAX_PER_RUN,
            AUDIT_PRUNE_MAX_PER_RUN
        ])
        for (const event of events) expect(event.durationMs).toBeGreaterThanOrEqual(0)
        expect(JSON.stringify(readStructuredLog())).not.toContain('t707-seeded')
    })

    it('分块大小 ≤200（常量契约，防止退回「一次性巨型事务」）', () => {
        expect(AUDIT_PRUNE_CHUNK_SIZE).toBeLessThanOrEqual(200)
        expect(AUDIT_PRUNE_MAX_PER_RUN).toBeLessThanOrEqual(400)
        expect(AUDIT_LIMIT).toBe(1000)
    })

    it('未溢出（≤1000 条且都在保留期内）⇒ 一条不删、无事件', async () => {
        await seedAuditRows(10, (index) => isoDaysAgo(1, index * 1000))
        await clearAudit(USER_ID)
        await seedAuditRows(10, (index) => isoDaysAgo(1, index * 1000))

        expect(await pruneAuditLog(USER_ID)).toBe(0)
        expect(await countAudit()).toBe(10)
        expect(evictedEvents()).toHaveLength(0)
    })
})