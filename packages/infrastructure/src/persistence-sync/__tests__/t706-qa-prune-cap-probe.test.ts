// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CreateTaskValueObject, UpdateTaskValueObject } from '@nao-todo/domain-task'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { clearStructuredLog, readStructuredLog } from '../../observability/structured-log'
import {
    AUDIT_PRUNE_CHUNK_SIZE,
    AUDIT_PRUNE_MAX_PER_RUN,
    clearAudit,
    pruneAuditLog
} from '../audit-log'

/**
 * T708 · `T707` 修复项 2 的**独立复验**（QA 自写，⛔ 不复用 `t707-*` 断言）
 *
 * 口径（`T707` 提交说明 + `T706` §7 实测）：
 * ① **限幅**：单次调度最多删 `AUDIT_PRUNE_MAX_PER_RUN`（400）条；
 * ② **分块**：每个 `bulkDelete` ≤ `AUDIT_PRUNE_CHUNK_SIZE`（200）键（块间让出事件循环）；
 * ③ **剩余量留给下一次调度**（不是「清一半就不管」）⇒ 反复调度必然收敛到 ≤1000；
 * ④ 有界修复后的**保存路径延迟**：2000 条溢出时 `update` 的 p99/max 不再出现秒级尖峰。
 *
 * 断言只认「可观测行为」：删除条数（返回值 + 实际剩余）、`bulkDelete` 每批键数（spy 实测）、
 * 结构化事件 `audit.entry.evicted`（count / durationMs）。
 */

const USER = 't708-prune-user'
const N = 2000 // 溢出 1000 条

const resetState = async (): Promise<void> => {
    for (const table of [
        'projects',
        'projectPreferences',
        'tags',
        'tagPreferences',
        'tasks',
        'taskCheckItems',
        'taskComments',
        'pomodoros',
        'pomodoroRecords',
        'users',
        'userConfigs',
        'meta',
        'deletionSchedules',
        'syncQueue',
        'syncCursor',
        'auditLogs'
    ]) {
        await localDatabase.table(table).clear()
    }
    localStorage.clear()
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t708-probe')
    cryptoService.lock()
    localSession.setCurrentUserId(USER)
    await cryptoService.setup(USER, 't708-password')
    clearStructuredLog()
}

/** 铺 N 条「近期」审计（只触发条数界，不触发 90 天界） */
const seedRows = async (count: number): Promise<void> => {
    const now = Date.now()
    await localDatabase.table('auditLogs').bulkAdd(
        Array.from({ length: count }, (_, index) => ({
            userId: USER,
            entity: 'tasks',
            entityId: `t708-seed-${index}`,
            action: 'update',
            source: 'local-edit',
            fields: [],
            at: new Date(now - 30 * 24 * 3600 * 1000 + index).toISOString()
        })) as never[]
    )
}

const auditCount = async (): Promise<number> =>
    localDatabase.table('auditLogs').where('userId').equals(USER).count()

const evictedEvents = (): Array<{ count: number; durationMs: number }> =>
    readStructuredLog()
        .filter((entry) => String(entry.event) === 'audit.entry.evicted')
        .map((entry) => ({
            count: Number(entry.fields.count ?? -1),
            durationMs: Number(entry.fields.durationMs ?? -1)
        }))

const makeTask = async (): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(
        new CreateTaskValueObject(
            null,
            null,
            'T708 任务',
            'T708 描述',
            'todo',
            'medium',
            null,
            null,
            'project-t708',
            [],
            null,
            'none',
            null,
            []
        )
    )
    expect(err).toBeNull()
    return task!.id
}

const patch = async (id: string, name: string): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    vo.name = name
    expect(await newLocalTaskRepository().update(id, vo)).toBeNull()
}

describe('T708 / M7 复验：裁切限幅 + 分块（可观测口径）', () => {
    beforeEach(resetState)

    it('2000 条溢出：单次调度删除 ≤400、每批 bulkDelete ≤200 键、事件记录条数与耗时', async () => {
        // ⚠️ 本例**不建任务、不写入**：任何写入都会触发 500ms 防抖裁切，与本次手动调度叠加会污染计数
        await seedRows(N)
        expect(await auditCount()).toBe(N)

        const table = localDatabase.table('auditLogs')
        const originalBulkDelete = Object.getPrototypeOf(table).bulkDelete as (
            keys: readonly number[]
        ) => Promise<unknown>
        const chunkSizes: number[] = []
        const spy = vi
            .spyOn(
                Object.getPrototypeOf(table) as { bulkDelete: typeof originalBulkDelete },
                'bulkDelete'
            )
            .mockImplementation(function (this: unknown, keys: readonly number[]) {
                chunkSizes.push(keys.length)
                return originalBulkDelete.call(this as never, keys) as never
            } as never)

        try {
            const removed = await pruneAuditLog(USER)

            // ① 限幅
            expect(removed, `单次调度不得超过 ${AUDIT_PRUNE_MAX_PER_RUN} 条`).toBeLessThanOrEqual(
                AUDIT_PRUNE_MAX_PER_RUN
            )
            expect(removed).toBeGreaterThan(0)
            // ② 分块：每批 ≤200 键，且 400 条至少分 2 批
            expect(chunkSizes.length).toBeGreaterThanOrEqual(2)
            for (const size of chunkSizes) {
                expect(
                    size,
                    `单批 bulkDelete 不得超过 ${AUDIT_PRUNE_CHUNK_SIZE} 键`
                ).toBeLessThanOrEqual(AUDIT_PRUNE_CHUNK_SIZE)
            }
            // ③ 实际剩余 = 初始 − 删除
            expect(await auditCount()).toBe(N - removed)
            // ④ 观测事件（只含数字）
            const events = evictedEvents()
            expect(events).toHaveLength(1)
            expect(events[0]!.count).toBe(removed)
            expect(events[0]!.durationMs).toBeGreaterThanOrEqual(0)
        } finally {
            spy.mockRestore()
        }
    }, 120_000)

    it('剩余量由「下一次调度」继续清 ⇒ 反复调度收敛到 ≤1000（不是清一半就不管）', async () => {
        await seedRows(N)
        const removedPerRun: number[] = []

        for (let run = 1; run <= 10; run += 1) {
            if ((await auditCount()) <= 1000) break
            removedPerRun.push(await pruneAuditLog(USER))
        }

        expect(removedPerRun.length, '2000 → 1000 至少需要 3 次调度').toBeGreaterThanOrEqual(3)
        expect(removedPerRun.every((count) => count <= AUDIT_PRUNE_MAX_PER_RUN)).toBe(true)
        expect(await auditCount(), '反复调度后必须收敛到上限内').toBe(1000)
        // eslint-disable-next-line no-console
        console.log(`[T708] 手动调度收敛：每次删除 ${removedPerRun.join(',')} ⇒ 终值 1000`)
    }, 120_000)

    it('真实写入驱动的调度也能收敛（2000 条 ⇒ 多次保存后 ≤1000，且每次递减）', async () => {
        const id = await makeTask()
        await clearAudit()
        await seedRows(N)

        const counts: number[] = [await auditCount()]
        for (let round = 1; round <= 6; round += 1) {
            await patch(id, `T708 收敛-${round}`)
            // 防抖窗口（500ms）+ 实际删除：等待「条数确实下降」
            await vi.waitFor(
                async () => {
                    const current = await auditCount()
                    expect(current).toBeLessThan(counts[counts.length - 1]!)
                },
                { timeout: 20_000, interval: 100 }
            )
            counts.push(await auditCount())
            if (counts[counts.length - 1]! <= 1000) break
            // 让下一次写入落在新的防抖窗口内（否则会与上一次定时器合并）
            await new Promise((resolve) => setTimeout(resolve, 700))
        }

        expect(counts, `每轮必须递减：${counts.join(' → ')}`).toEqual(
            [...counts].sort((left, right) => right - left)
        )
        expect(counts[counts.length - 1]!).toBeLessThanOrEqual(1000)
        // eslint-disable-next-line no-console
        console.log(`[T708] 写入驱动收敛：${counts.join(' → ')}`)
    }, 180_000)

    it('过期路径（1200 条全过期）同样限幅：一次调度 ≤400、剩余仍在，连续调度直到清零', async () => {
        // PM 指定场景：1200 条 `at` 早于 90 天 ⇒ 走**时间界**（不是条数界）
        const now = Date.now()
        await localDatabase.table('auditLogs').bulkAdd(
            Array.from({ length: 1200 }, (_, index) => ({
                userId: USER,
                entity: 'tasks',
                entityId: `t708-expired-${index}`,
                action: 'update',
                source: 'local-edit',
                fields: [],
                at: new Date(now - 200 * 24 * 3600 * 1000 + index).toISOString()
            })) as never[]
        )
        expect(await auditCount()).toBe(1200)

        const removedPerRun: number[] = []
        for (let run = 1; run <= 6; run += 1) {
            const removed = await pruneAuditLog(USER)
            removedPerRun.push(removed)
            if (removed === 0) break
            if (run === 1) {
                // 首次调度后：只删了 ≤400，剩余过期行**仍在**（不是「清一半就不管」）
                expect(removed).toBeLessThanOrEqual(AUDIT_PRUNE_MAX_PER_RUN)
                expect(await auditCount()).toBe(1200 - removed)
            }
        }

        expect(removedPerRun[0]!).toBeLessThanOrEqual(AUDIT_PRUNE_MAX_PER_RUN)
        expect(removedPerRun.length, '1200 条过期至少需要 3 次调度').toBeGreaterThanOrEqual(3)
        expect(await auditCount(), '连续调度后过期行必须清零').toBe(0)
        // eslint-disable-next-line no-console
        console.log(`[T708] 过期路径收敛：每次删除 ${removedPerRun.join(',')} ⇒ 终值 0`)
    }, 180_000)

    it('最坏合成场景：裁切（2 块 ×200）与一次写入重叠时的单次 update 尾值', async () => {
        const id = await makeTask()
        await clearAudit()
        await seedRows(N) // 2000 条都在保留期内 ⇒ 条数界，一轮删 400（2 块）

        // 第一次写：只负责把裁切调度起来（500ms 防抖）
        await patch(id, 'T708 触发裁切')
        await new Promise((resolve) => setTimeout(resolve, 500 + 50))

        // 裁切正在跑（2 块 ×200 行）时插一次写：量「被巨型删除拖慢」的尾值
        const startedAt = performance.now()
        await patch(id, 'T708 裁切中写入')
        const overlapped = performance.now() - startedAt
        // eslint-disable-next-line no-console
        console.log(
            `[T708] 裁切并发写入耗时 = ${overlapped.toFixed(1)}ms（fake-indexeddb；rd-fe 同场景报 753ms）`
        )
        // 非门禁级阈值：只防「回到十秒级」（一次性删 2000 条 ≈10.5s）
        expect(overlapped).toBeLessThan(5000)
    }, 180_000)

    it('保存路径无秒级尖峰（2000 条溢出下 10 次 update 的 p50/p99/max，含裁切并发）', async () => {
        const id = await makeTask()
        await clearAudit()
        await seedRows(N)

        const durations: number[] = []
        for (let index = 0; index < 10; index += 1) {
            const startedAt = performance.now()
            await patch(id, `T708 延迟-${index}`)
            durations.push(performance.now() - startedAt)
        }
        const sorted = [...durations].sort((left, right) => left - right)
        const p50 = sorted[Math.floor(0.5 * sorted.length)]!
        const p99 = sorted[Math.min(sorted.length - 1, Math.floor(0.99 * sorted.length))]!
        const max = sorted[sorted.length - 1]!
        // eslint-disable-next-line no-console
        console.log(
            `[T708] update@2000溢出: p50=${p50.toFixed(1)} p99=${p99.toFixed(1)} max=${max.toFixed(1)}ms（fake-indexeddb，绝对值偏高）`
        )
        // 非门禁级阈值：只防「回到 T706 的秒级/十秒级」退化（当时一次性删 2000 条 ≈10.5s）
        expect(max, `max=${max.toFixed(1)}ms`).toBeLessThan(5000)
    }, 180_000)
})