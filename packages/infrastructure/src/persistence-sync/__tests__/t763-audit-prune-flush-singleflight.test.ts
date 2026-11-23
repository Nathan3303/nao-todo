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
import { AUDIT_PRUNE_MAX_PER_RUN, clearAudit, flushAuditPrune, pruneAuditLog } from '../audit-log'

/**
 * `T763` · 审计裁切的两条根治项（B 测试可排空 + C 单飞/补排/物理计数）
 *
 * 背景（`docs/reports/2026-11-23-t706-prune-flake.md` / `T762b`）：`t706-qa-prune-cap-probe` 间歇红
 * 的根因是**跨用例异步残留**（模块级 `pruneTimers` 无人清理 + 无 in-flight 去重 ⇒ 两轮裁切交叠，
 * 物理删 600 而用例返 400）；附带「`evicted.count` 多报」（请求删 400、实际只删 200）。
 *
 * 本文件的口径（只认可观测行为，⛔ 不 mock 被测逻辑）：
 * - B：`flushAuditPrune()` 后**无待触发定时器 + 无在飞裁切**（行为断言：静置 1.8s 条数不变）；
 * - C1 **单飞有牙**：裁切进行中再次请求 ⇒ 在飞期间**不得**出现第二次 `bulkDelete`（并发两轮）；
 * - C2 **补排恰好一次**：运行中到达 3 个请求 ⇒ 结束后只补跑 **1** 轮（`bulkDelete` 共 4 次 = 2 轮 × 2 块）；
 * - C3 **计数 = 物理删除**：重叠裁切下各轮 `audit.entry.evicted.count` 之和 = `auditCount` 差值。
 *
 * 变异靶（⛔ 去掉实现里的对应机制必须变红）：C1 → `runPrune` 的 in-flight 判据；C2 → `runPruneRounds`
 * 的补排循环；C3 → `deleteAuditRowsInChunks` 的现存键计数。
 */

const USER = 't763-prune-user'
const N = 2000 // 溢出 1000 条 ⇒ 条数界，一轮删 400（2 块 ×200）
/** 防抖 500ms + 余量：让「500ms 后到期」的定时器确实烧掉 */
const DEBOUNCE_SETTLE_MS = 700

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const resetState = async (): Promise<void> => {
    // 清表**之前**先排空裁切（同 `t706-qa-prune-cap-probe` 的修法，`T763` B）
    await flushAuditPrune()
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
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t763-probe')
    cryptoService.lock()
    localSession.setCurrentUserId(USER)
    await cryptoService.setup(USER, 't763-password')
    clearStructuredLog()
}

/** 铺 `count` 条「近期」审计（30 天前 ⇒ 只触发条数界，不触发 90 天界） */
const seedRows = async (count: number): Promise<void> => {
    const now = Date.now()
    await localDatabase.table('auditLogs').bulkAdd(
        Array.from({ length: count }, (_, index) => ({
            userId: USER,
            entity: 'tasks',
            entityId: `t763-seed-${index}`,
            action: 'update',
            source: 'local-edit',
            fields: [],
            at: new Date(now - 30 * 24 * 3600 * 1000 + index).toISOString()
        })) as never[]
    )
}

/** 铺 `count` 条「全过期」审计（200 天前 ⇒ 走时间界） */
const seedExpired = async (count: number): Promise<void> => {
    const now = Date.now()
    await localDatabase.table('auditLogs').bulkAdd(
        Array.from({ length: count }, (_, index) => ({
            userId: USER,
            entity: 'tasks',
            entityId: `t763-expired-${index}`,
            action: 'update',
            source: 'local-edit',
            fields: [],
            at: new Date(now - 200 * 24 * 3600 * 1000 + index).toISOString()
        })) as never[]
    )
}

const auditCount = async (): Promise<number> =>
    localDatabase.table('auditLogs').where('userId').equals(USER).count()

const evictedCounts = (): number[] =>
    readStructuredLog()
        .filter((entry) => String(entry.event) === 'audit.entry.evicted')
        .map((entry) => Number(entry.fields.count ?? -1))

const makeTask = async (): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(
        new CreateTaskValueObject(
            null,
            null,
            'T763 任务',
            'T763 描述',
            'todo',
            'medium',
            null,
            null,
            'project-t763',
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

/** 一次真实写入（会追加 1 条审计 + 触发 500ms 防抖裁切 —— 走的是生产调度路径） */
const patch = async (id: string, name: string): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    vo.name = name
    expect(await newLocalTaskRepository().update(id, vo)).toBeNull()
}

type BulkDeleteFn = (this: unknown, keys: readonly number[]) => Promise<unknown>

/** 取 `auditLogs` 表原型的 `bulkDelete`（分块探针的唯一挂点：每块 ≤200 键） */
const bulkDeleteProto = (): { bulkDelete: BulkDeleteFn } =>
    Object.getPrototypeOf(localDatabase.table('auditLogs')) as { bulkDelete: BulkDeleteFn }

interface BulkDeleteGate {
    /** 每批 `bulkDelete` 的键数（= 一次物理删除块的规模） */
    calls: number[]
    /** 第 1 批已被调用（= 一轮裁切起来并卡在第一次物理删除之前） */
    firstCallStarted: Promise<void>
    release: () => void
    restore: () => void
}

/**
 * 闸门：卡住**第 1 批** `bulkDelete`（不释放 ⇒ 那一轮裁切一直处于在飞状态）
 * @description 卡点在 `bulkDelete` 调用点（⛔ 不在事务内），用来构造「裁切进行中又来了请求」。
 */
const installBulkDeleteGate = (): BulkDeleteGate => {
    const proto = bulkDeleteProto()
    const original = proto.bulkDelete
    const calls: number[] = []
    let startFirst: () => void = () => {}
    const firstCallStarted = new Promise<void>((resolve) => {
        startFirst = resolve
    })
    let releaseGate: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
        releaseGate = resolve
    })
    const spy = vi.spyOn(proto, 'bulkDelete').mockImplementation(async function (
        this: unknown,
        keys: readonly number[]
    ) {
        calls.push(keys.length)
        if (calls.length === 1) {
            startFirst()
            await gate
        }
        return original.call(this, keys)
    } as never)
    return {
        calls,
        firstCallStarted,
        release: () => releaseGate(),
        restore: () => spy.mockRestore()
    }
}

describe('T763 / 审计裁切：B 可排空 + C 单飞 / 补排 / 物理计数', () => {
    beforeEach(resetState)

    it('B · flushAuditPrune 清掉待触发定时器（之后不再发生裁切），且幂等', async () => {
        const id = await makeTask()
        await flushAuditPrune() // 清掉 create 触发的定时器，从这里开始计时
        await clearAudit()
        await seedRows(N)
        // 一次真实写入 ⇒ 排了一次 500ms 防抖裁切（尚未触发）
        await patch(id, 'T763 flush-触发')
        const before = await auditCount()
        expect(before).toBe(N + 1)

        await flushAuditPrune()
        // 静置 ≫ 防抖 500ms + 一轮裁切（实测约 1s）：定时器若没被清掉，这里会少 400 条
        await sleep(1800)
        expect(await auditCount(), '待触发的裁切必须被 flush 清掉（静置后条数不得变）').toBe(before)

        // 幂等：再 flush 一次无任何副作用
        await flushAuditPrune()
        expect(await auditCount()).toBe(before)
    }, 60_000)

    it('B · flushAuditPrune await 在飞裁切（裁切 settle 之前不返回）', async () => {
        const id = await makeTask()
        await flushAuditPrune()
        await clearAudit()
        await seedRows(N)

        const gate = installBulkDeleteGate()
        try {
            await patch(id, 'T763 flush-在飞')
            await gate.firstCallStarted // 一轮裁切已起来，卡在第 1 批物理删除之前

            let flushed = false
            const flushing = flushAuditPrune().then(() => {
                flushed = true
            })
            await sleep(150)
            expect(flushed, '在飞裁切未 settle 时 flush 不得返回').toBe(false)

            gate.release()
            await flushing
            expect(flushed).toBe(true)
            // 那轮裁切确实跑完了：2001 − 400
            expect(await auditCount()).toBe(N + 1 - AUDIT_PRUNE_MAX_PER_RUN)
        } finally {
            gate.restore()
        }
    }, 60_000)

    it('C1 · 单飞：裁切进行中再次请求不并发跑；结束后补跑恰好一轮', async () => {
        const id = await makeTask()
        await flushAuditPrune()
        await clearAudit()
        await seedRows(N)

        const gate = installBulkDeleteGate()
        try {
            await patch(id, 'T763 单飞-触发')
            await gate.firstCallStarted // 第 1 轮在飞且被卡住

            // 在飞期间再来一次真实写入 ⇒ 500ms 后会到期一次裁切请求
            await patch(id, 'T763 单飞-在飞期间请求')
            await sleep(DEBOUNCE_SETTLE_MS)

            expect(
                gate.calls.length,
                '在飞期间不得再起一轮裁切（两轮 bulkDelete 并发 ⇒ 单窗口物理删除超 400）'
            ).toBe(1)

            gate.release()
            await flushAuditPrune()
            // 原轮 2 块 + 补排轮 2 块；每轮 ≤400（物理删除），合计 800
            expect(gate.calls.length).toBe(4)
            expect(await auditCount()).toBe(N + 2 - 2 * AUDIT_PRUNE_MAX_PER_RUN)
        } finally {
            gate.restore()
        }
    }, 60_000)

    it('C2 · 补排：运行中到达 3 个请求 ⇒ 只补跑一轮（不是 3 轮），且这轮同样限幅', async () => {
        const id = await makeTask()
        await flushAuditPrune()
        await clearAudit()
        await seedRows(N)

        const gate = installBulkDeleteGate()
        try {
            await patch(id, 'T763 补排-触发')
            await gate.firstCallStarted

            // 3 个请求分别落在**不同**的防抖窗口（每次间隔 > 500ms ⇒ 三次请求都真的到达调度器）
            for (let round = 0; round < 3; round += 1) {
                await patch(id, `T763 补排-运行中请求-${round}`)
                await sleep(DEBOUNCE_SETTLE_MS)
            }
            expect(gate.calls.length, '在飞期间一次都不许并发跑').toBe(1)

            gate.release()
            await flushAuditPrune()
            // 原轮 2 块 + **恰好一轮**补排 2 块（若按请求数放大 ⇒ 会是 8 次）
            expect(gate.calls.length).toBe(4)
            expect(evictedCounts()).toEqual([AUDIT_PRUNE_MAX_PER_RUN, AUDIT_PRUNE_MAX_PER_RUN])
            // 账本按规则继续收敛：2000 + 4 条写入 − 800 = 1204
            expect(await auditCount()).toBe(N + 4 - 2 * AUDIT_PRUNE_MAX_PER_RUN)
        } finally {
            gate.restore()
        }
    }, 120_000)

    it('C3 · 计数 = 物理删除：重叠裁切下 evicted.count 之和 = auditCount 差值', async () => {
        await clearAudit()
        await seedExpired(1200)
        expect(await auditCount()).toBe(1200)

        const proto = bulkDeleteProto()
        const original = proto.bulkDelete
        const calls: number[] = []
        let overlapping = 0
        const spy = vi.spyOn(proto, 'bulkDelete').mockImplementation(async function (
            this: unknown,
            keys: readonly number[]
        ) {
            calls.push(keys.length)
            const result = await original.call(this, keys)
            if (calls.length === 1) {
                // 第 1 块删完后，**另一轮真实裁切**接管剩余的过期行（本轮随后那块的键已被对方删掉）
                overlapping = await pruneAuditLog(USER)
            }
            return result
        } as never)

        try {
            const removed = await pruneAuditLog(USER)
            const delta = 1200 - (await auditCount())

            // 两轮都真的运行过（不是被单飞合成一轮的假重叠）
            expect(overlapping).toBe(AUDIT_PRUNE_MAX_PER_RUN)
            expect(removed).toBeGreaterThan(0)
            expect(removed).toBeLessThan(AUDIT_PRUNE_MAX_PER_RUN)
            // ① 各轮事件 count = 各自的物理删除数
            expect([...evictedCounts()].sort((left, right) => left - right)).toEqual(
                [removed, overlapping].sort((left, right) => left - right)
            )
            // ② 事件之和 = 实际物理删除总量（⛔ 多报「请求删但已被对方删掉的键」）
            expect(evictedCounts().reduce((sum, count) => sum + count, 0)).toBe(delta)
            expect(removed + overlapping).toBe(delta)
        } finally {
            spy.mockRestore()
        }
    }, 60_000)
})