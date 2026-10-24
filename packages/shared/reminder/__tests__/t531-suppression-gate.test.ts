import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    createClaimLedger,
    createReminderEngine,
    REMINDER_SCAN_INTERVAL_MS,
    type ReminderTask,
    type TaskReminderEvent
} from '@nao-todo/shared/reminder'
import { FakeStorage, flushMicrotasks, makeTask } from './reminder-harness'

/**
 * T531 · 免打扰抑制门（AC4 / AC5 / AC1 即时生效 · 红基线）
 *
 * 契约（RD 按此实现，`ReminderEngineDeps` 新增**可选**端口）：
 *
 * ```ts
 * isSuppressed?: (nowMs: number) => boolean   // 每轮扫描在 collect / claim 之前调用一次
 * ```
 *
 * 硬约束（PRD §五 R2/R3 · 架构报告 §3.1）：
 * - 门必须在 `ledger.claim` **之前**；抑制时**零副作用**：0 claim / 0 notify / 0 consume，
 *   且任务 `remindAt` 不变、账本不产生新键（否则时段结束永久不弹）；
 * - 门**不得**放在 `notify` 端口内（claim 已落 ⇒ 永久丢）—— 本文件含该错误形态的反证用例；
 * - 每轮扫描**重读**（设置改动即时生效，≤1 轮 = 10s），不做缓存；
 * - 门抛错 ⇒ **fail-open**（视为不抑制，提醒照常，不中断扫描）；
 * - 未注入 `isSuppressed` ⇒ 与 `v1.12.15` 行为完全一致（AC12 回归）。
 *
 * 补弹**不新增触发器**：由既有 10s 轮询 / `rescan()`（回前台 / 冷启动）覆盖。
 * 时间一律**本地墙钟**构造（DEF-81：禁 UTC 字面量）。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §五 R2/R3 · §七 AC4/AC5
 */

/** 本地墙钟基准：2026-10-24 22:30（免打扰段内） */
const BASE = new Date(2026, 9, 24, 22, 30, 0, 0).getTime()
/** 免打扰段 22:00 – 次日 08:00 的两个端点（本地墙钟） */
const QUIET_START = new Date(2026, 9, 24, 22, 0, 0, 0).getTime()
const QUIET_END = new Date(2026, 9, 25, 8, 0, 0, 0).getTime()

const isoAt = (ms: number): string => new Date(ms).toISOString()

/** 可变时钟（假定时器推进时同步 `now()` 口径） */
let currentNow = BASE

const advance = async (ms: number): Promise<void> => {
    currentNow += ms
    vi.setSystemTime(currentNow)
    await vi.advanceTimersByTimeAsync(ms)
    await flushMicrotasks()
}

/** 跳到指定时刻（避免为了跨 9.5 小时而空转 3000+ 轮轮询） */
const jumpTo = (ms: number): void => {
    currentNow = ms
    vi.setSystemTime(currentNow)
}

type HarnessOptions = {
    tasks: ReminderTask[]
    /** 初始是否处于免打扰（运行期可改 `state.suppressed` ⇒ 断言「即时生效」） */
    suppressed?: boolean
    /** 不注入端口（AC12 回归） */
    omitGate?: boolean
    /** 门抛错（fail-open 用例） */
    gateThrows?: boolean
    storage?: FakeStorage
    onConsume?: (taskId: string, nextRemindAt: string | null) => void
}

const createHarness = (options: HarnessOptions) => {
    const storage = options.storage ?? new FakeStorage()
    const baseLedger = createClaimLedger({ storage })
    const claim = vi.fn((key: string) => baseLedger.claim(key))
    const ledger = { claim, has: (key: string) => baseLedger.has(key) }
    const notify = vi.fn((_event: TaskReminderEvent) => undefined)
    const consume = vi.fn((taskId: string, nextRemindAt: string | null) => {
        options.onConsume?.(taskId, nextRemindAt)
    })
    /** 运行期门状态（同一闭包 ⇒ 改它即模拟「用户改了设置」） */
    const state = { suppressed: options.suppressed === true }
    const gate = vi.fn((_nowMs: number) => {
        if (options.gateThrows) throw new Error('settings unavailable')
        return state.suppressed
    })

    const engine = createReminderEngine({
        listCandidates: async () => options.tasks,
        now: () => currentNow,
        ledger,
        notify,
        consume,
        ...(options.omitGate ? {} : { isSuppressed: (nowMs: number) => gate(nowMs) })
    })

    return { engine, storage, claim, notify, consume, gate, state }
}

/** 消费回写（模拟仓库写：重复 ⇒ 推进；一次性 ⇒ 清空） */
const consumeInto = (taskId: string, nextRemindAt: string | null, tasks: ReminderTask[]): void => {
    const target = tasks.find((item) => item.id === taskId)
    if (target) target.remindAt = nextRemindAt
}

beforeEach(() => {
    currentNow = BASE
    vi.useFakeTimers({ now: BASE })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('T531 · AC4 免打扰时段内零副作用', () => {
    it('AC4 首轮扫描即被抑制 ⇒ 0 claim / 0 notify / 0 consume', async () => {
        const task = makeTask({ id: 't1', remindAt: isoAt(QUIET_START + 30 * 60_000) })
        const { engine, claim, notify, consume } = createHarness({
            tasks: [task],
            suppressed: true
        })

        engine.start()
        await flushMicrotasks()

        expect(claim).not.toHaveBeenCalled()
        expect(notify).not.toHaveBeenCalled()
        expect(consume).not.toHaveBeenCalled()
    })

    it('AC4 时段内连续 3 轮轮询 ⇒ 仍零副作用，且 remindAt 未推进、账本无新键', async () => {
        const remindAt = isoAt(QUIET_START + 30 * 60_000)
        const task = makeTask({ id: 't1', remindAt })
        const { engine, claim, notify, consume, storage } = createHarness({
            tasks: [task],
            suppressed: true
        })

        engine.start()
        await flushMicrotasks()
        await advance(REMINDER_SCAN_INTERVAL_MS * 3)

        expect(claim).not.toHaveBeenCalled()
        expect(notify).not.toHaveBeenCalled()
        expect(consume).not.toHaveBeenCalled()
        expect(task.remindAt).toBe(remindAt)
        expect(storage.getItem('nao-todo:reminder-claims') ?? '').not.toContain(remindAt)
    })

    it('AC4 门必须先于 claim（调用顺序证据 ⇒ 变异可检测）', async () => {
        const task = makeTask({ id: 't1', remindAt: isoAt(QUIET_START + 30 * 60_000) })
        const order: string[] = []
        const storage = new FakeStorage()
        const baseLedger = createClaimLedger({ storage })
        const engine = createReminderEngine({
            listCandidates: async () => [task],
            now: () => currentNow,
            ledger: {
                claim: (key: string) => {
                    order.push('claim')
                    return baseLedger.claim(key)
                },
                has: (key: string) => baseLedger.has(key)
            },
            notify: () => {
                order.push('notify')
            },
            consume: () => {
                order.push('consume')
            },
            isSuppressed: () => {
                order.push('isSuppressed')
                return true
            }
        })

        engine.start()
        await flushMicrotasks()

        expect(order).toEqual(['isSuppressed'])
    })

    it('AC4 反证（门缺失）⇒ 同场景必然 claim + notify（证明用例能检测「门未生效」）', async () => {
        const task = makeTask({ id: 't1', remindAt: isoAt(QUIET_START + 30 * 60_000) })
        const { engine, claim, notify } = createHarness({ tasks: [task] })

        engine.start()
        await flushMicrotasks()

        expect(claim).toHaveBeenCalledTimes(1)
        expect(notify).toHaveBeenCalledTimes(1)
    })

    it('AC4 反证（错误形态：门放进 notify）⇒ 账本已落 + 未提醒 + 已被消费 ⇒ 该条永久丢', async () => {
        // 锁定用例集的判别力：本需求要避免的形态是「claim 已落 + 用户从未看到」。
        //
        // ⚠️ 为何断言 **consume 被调用 1 次**（而不是「未 consume」）：
        // 按 C2 口径，通知适配层**永不抛**（不可用/构造失败都在层内降级为「未送达」标记），
        // 因此「门放进 notify」的真实形态 = notify 静默返回 ⇒ 引擎照常 consume。
        // 真实危害 = 「用户从未看到，却已被当作已交付处理」（重复提醒被静默推进 / 一次性被静默清空），
        // 且键已落账 ⇒ 再扫也不会补 ⇒ 永久丢。
        // （「notify 真的抛错 ⇒ 引擎不 consume」是另一条分支，由既有
        //  `create-reminder-engine.test.ts` 的 notify 抛错用例锁定，不在本反证内。）
        const task = makeTask({ id: 't1', remindAt: isoAt(QUIET_START + 30 * 60_000) })
        const storage = new FakeStorage()
        const ledger = createClaimLedger({ storage })
        const notify = vi.fn()
        const consume = vi.fn()
        const engine = createReminderEngine({
            listCandidates: async () => [task],
            now: () => currentNow,
            ledger,
            notify: (event) => {
                if (currentNow < QUIET_END) return // ← 门放错位置（claim 已发生）
                notify(event)
            },
            consume
        })

        engine.start()
        await flushMicrotasks()

        expect(notify).not.toHaveBeenCalled() // 用户从未看到
        expect(ledger.has(`${task.id}@${task.remindAt}`)).toBe(true) // 键已落账
        expect(consume).toHaveBeenCalledTimes(1) // 却已被当作已交付处理

        // 永久丢的反证：再扫一轮（即使已过免打扰时段）也不会再提醒
        currentNow = QUIET_END + 60_000
        vi.setSystemTime(currentNow)
        await engine.rescan()
        await flushMicrotasks()

        expect(notify).not.toHaveBeenCalled()
        expect(consume).toHaveBeenCalledTimes(1)
    })
})

describe('T531 · AC5 时段结束后补弹（每条恰好 1 次）', () => {
    it('AC5 时段结束后下一轮按 remindAt 升序逐条补弹，各 1 次', async () => {
        const tasks: ReminderTask[] = [
            makeTask({ id: 'late', remindAt: isoAt(QUIET_START + 50 * 60_000) }), // 22:50
            makeTask({ id: 'early', remindAt: isoAt(QUIET_START + 10 * 60_000) }), // 22:10
            makeTask({ id: 'mid', remindAt: isoAt(QUIET_END - 30 * 60_000) }) // 次日 07:30
        ]
        const { engine, claim, notify, consume, state } = createHarness({
            tasks,
            suppressed: true,
            onConsume: (taskId, nextRemindAt) => consumeInto(taskId, nextRemindAt, tasks)
        })

        engine.start()
        await flushMicrotasks()
        expect(notify).not.toHaveBeenCalled()

        // 时段结束（门解除：引擎每轮重读设置）
        state.suppressed = false
        jumpTo(QUIET_END + 1_000)
        await advance(REMINDER_SCAN_INTERVAL_MS)

        // 升序按**绝对触发时刻**：22:10 → 22:50 → **次日 07:30**
        // （跨天项必须排在后面：若按「一天内的时分」比较，07:30 会被错排到最前）
        const notifiedIds = notify.mock.calls.map((call) => (call[0] as TaskReminderEvent).taskId)
        expect(notifiedIds).toEqual(['early', 'late', 'mid'])
        expect(claim).toHaveBeenCalledTimes(3)
        expect(consume).toHaveBeenCalledTimes(3)
    })

    it('AC5 补弹后（重复已推进 / 一次性已清空）⇒ 再 3 轮不弹；重启引擎（同账本）仍不弹', async () => {
        const repeat = makeTask({
            id: 'daily',
            remindAt: isoAt(QUIET_START + 10 * 60_000),
            remindRepeat: 'daily',
            remindTime: '22:10'
        })
        const once = makeTask({ id: 'once', remindAt: isoAt(QUIET_START + 20 * 60_000) })
        const tasks: ReminderTask[] = [repeat, once]
        const storage = new FakeStorage()
        const originalRepeatAt = repeat.remindAt
        const { engine, notify, state } = createHarness({
            tasks,
            suppressed: true,
            storage,
            onConsume: (taskId, nextRemindAt) => consumeInto(taskId, nextRemindAt, tasks)
        })

        engine.start()
        await flushMicrotasks()

        state.suppressed = false
        jumpTo(QUIET_END + 1_000)
        await advance(REMINDER_SCAN_INTERVAL_MS)

        expect(notify).toHaveBeenCalledTimes(2)
        expect(repeat.remindAt).not.toBe(originalRepeatAt)
        expect(once.remindAt).toBeNull()

        await advance(REMINDER_SCAN_INTERVAL_MS * 3)
        expect(notify).toHaveBeenCalledTimes(2)

        engine.stop()
        const restarted = createHarness({
            tasks,
            storage,
            onConsume: (taskId, nextRemindAt) => consumeInto(taskId, nextRemindAt, tasks)
        })
        restarted.engine.start()
        await flushMicrotasks()
        expect(restarted.notify).not.toHaveBeenCalled()
    })

    it('AC5 回前台 / 冷启动（rescan）在时段结束后 ⇒ 补弹恰好 1 次（不新增触发器）', async () => {
        const task = makeTask({ id: 't1', remindAt: isoAt(QUIET_START + 10 * 60_000) })
        const { engine, notify, state } = createHarness({ tasks: [task], suppressed: true })

        engine.start()
        await flushMicrotasks()
        expect(notify).not.toHaveBeenCalled()

        state.suppressed = false
        jumpTo(QUIET_END + 1_000)
        await engine.rescan()
        await flushMicrotasks()
        expect(notify).toHaveBeenCalledTimes(1)

        await engine.rescan()
        await flushMicrotasks()
        expect(notify).toHaveBeenCalledTimes(1)
    })
})

describe('T531 · AC1 即时生效 / 异常 fail-open / AC12 回归', () => {
    it('AC1 同一引擎内门由抑制→放行 ⇒ ≤1 轮（10s）内补弹（每轮重读，不缓存）', async () => {
        const task = makeTask({ id: 't1', remindAt: isoAt(QUIET_START + 10 * 60_000) })
        const { engine, notify, gate, state } = createHarness({ tasks: [task], suppressed: true })

        engine.start()
        await flushMicrotasks()
        expect(notify).not.toHaveBeenCalled()

        state.suppressed = false
        await advance(REMINDER_SCAN_INTERVAL_MS)

        expect(gate.mock.calls.length).toBeGreaterThanOrEqual(2) // 首轮 + 本轮回调
        expect(notify).toHaveBeenCalledTimes(1)
    })

    it('E 门抛错（设置读取失败）⇒ fail-open：提醒照常，不中断扫描', async () => {
        const task = makeTask({ id: 't1', remindAt: isoAt(QUIET_START + 10 * 60_000) })
        const { engine, notify, consume } = createHarness({ tasks: [task], gateThrows: true })

        engine.start()
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(1)
        expect(consume).toHaveBeenCalledTimes(1)
    })

    it('AC12 未注入 isSuppressed ⇒ 行为与 v1.12.15 完全一致（照常 claim/notify/consume）', async () => {
        const task = makeTask({ id: 't1', remindAt: isoAt(QUIET_START + 10 * 60_000) })
        const { engine, claim, notify, consume } = createHarness({ tasks: [task], omitGate: true })

        engine.start()
        await flushMicrotasks()

        expect(claim).toHaveBeenCalledTimes(1)
        expect(notify).toHaveBeenCalledTimes(1)
        expect(consume).toHaveBeenCalledTimes(1)
    })
})