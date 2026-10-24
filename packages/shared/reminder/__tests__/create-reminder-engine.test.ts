import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    createClaimLedger,
    createReminderEngine,
    REMINDER_SCAN_INTERVAL_MS,
    type ReminderLedger,
    type ReminderTask,
    type TaskReminderEvent
} from '@nao-todo/shared/reminder'
import { FakeStorage, flushMicrotasks, makeTask } from './reminder-harness'

/**
 * T525 · 引擎 `createReminderEngine`（AC1–AC6 / AC8）
 *
 * @description 接缝契约见 `./reminder-harness.ts`。本文件全部用**注入 `now` + 假定时器**
 *              断言调度（⛔ 禁 sleep / 真实 wall clock，AC5 口径）。
 *              应用内弹窗与系统通知的「各 1 次」由 `notify` 适配层承载，此处断言
 *              **引擎恰好派发 1 次事件**；两条通道的分别断言见 AC9 适配层用例。
 * @see docs/prds/2026-10-23-reminder-local-polling.md §七
 */

const BASE = new Date('2026-10-23T10:00:00.000Z').getTime()
const iso = (offsetMs: number): string => new Date(BASE + offsetMs).toISOString()

type SetupOptions = {
    tasks: () => readonly ReminderTask[]
    storage?: FakeStorage
    ledger?: { claim: (key: string) => boolean }
    onNotify?: (event: TaskReminderEvent) => void
    onConsume?: (taskId: string, nextRemindAt: string | null) => void
    requestNotificationPermission?: () => void | Promise<unknown>
    now?: () => number
}

const setup = (options: SetupOptions) => {
    const storage = options.storage ?? new FakeStorage()
    const ledger = options.ledger ?? createClaimLedger({ storage })
    const notify = vi.fn((event: TaskReminderEvent) => options.onNotify?.(event))
    const consume = vi.fn((taskId: string, nextRemindAt: string | null) =>
        options.onConsume?.(taskId, nextRemindAt)
    )
    const engine = createReminderEngine({
        listCandidates: async () => options.tasks(),
        now: options.now ?? (() => Date.now()),
        ledger,
        notify,
        consume,
        requestNotificationPermission: options.requestNotificationPermission
    })
    return { engine, notify, consume, ledger: ledger as ReminderLedger, storage }
}

beforeEach(() => {
    vi.useFakeTimers({ now: BASE })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('createReminderEngine · 主路径（AC1）', () => {
    it('AC1 start 首轮扫描到期活跃任务 ⇒ 派发 1 次，载荷 taskId/taskName/description（T531：含 projectId/remindAt）', async () => {
        const task = makeTask({
            id: 't1',
            name: '买菜',
            description: '别忘了买鸡蛋',
            remindAt: iso(-1000)
        })
        const { engine, notify } = setup({ tasks: () => [task] })

        engine.start()
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(1)
        expect(notify.mock.calls[0]?.[0]).toEqual({
            taskId: 't1',
            taskName: '买菜',
            description: '别忘了买鸡蛋',
            projectId: 'p-t1',
            remindAt: iso(-1000)
        })
    })

    it('AC1 多条同期到期 ⇒ 逐条派发（不聚合），按 remindAt 升序', async () => {
        const tasks = [
            makeTask({ id: 'late', remindAt: iso(-1000) }),
            makeTask({ id: 'early', remindAt: iso(-5000) }),
            makeTask({ id: 'mid', remindAt: iso(-3000) })
        ]
        const { engine, notify } = setup({ tasks: () => tasks })

        engine.start()
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(3)
        expect(notify.mock.calls.map((call) => (call[0] as TaskReminderEvent).taskId)).toEqual([
            'early',
            'mid',
            'late'
        ])
    })
})

describe('createReminderEngine · 离线（AC2）', () => {
    it('AC2 全流程 0 次网络 / 0 次 EventSource 构造', async () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)
        class EventSourceStub {
            static constructed = 0
            constructor(_url: string) {
                EventSourceStub.constructed += 1
            }
            addEventListener(): void {}
            close(): void {}
        }
        vi.stubGlobal('EventSource', EventSourceStub)

        const { engine, notify } = setup({
            tasks: () => [makeTask({ id: 'offline', remindAt: iso(-1000) })]
        })

        engine.start()
        await vi.advanceTimersByTimeAsync(30_000)
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(1)
        expect(fetchSpy).not.toHaveBeenCalled()
        expect(EventSourceStub.constructed).toBe(0)
    })
})

describe('createReminderEngine · 唯一性（AC3）', () => {
    it('AC3 跨标签：两引擎共享同一 storage 账本 ⇒ 合计恰好 1 次', async () => {
        const storage = new FakeStorage() // 同 origin 的 localStorage
        const tabs = [0, 1].map(() =>
            setup({
                tasks: () => [makeTask({ id: 't1', remindAt: iso(-1000) })],
                ledger: createClaimLedger({ storage })
            })
        )

        for (const tab of tabs) tab.engine.start()
        await flushMicrotasks()

        const total = tabs.reduce((sum, tab) => sum + tab.notify.mock.calls.length, 0)
        expect(total).toBe(1)
    })

    it('AC3 刷新 / 重开：同一 storage 上的新引擎不再弹', async () => {
        const storage = new FakeStorage()
        const first = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(-1000) })],
            ledger: createClaimLedger({ storage })
        })

        first.engine.start()
        await flushMicrotasks()
        expect(first.notify).toHaveBeenCalledTimes(1)

        const reopened = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(-1000) })],
            ledger: createClaimLedger({ storage })
        })
        reopened.engine.start()
        await flushMicrotasks()

        expect(reopened.notify).not.toHaveBeenCalled()
    })

    it('AC3 落账先于通知（先 claim 再 notify，防刷新期间重复）', async () => {
        const order: string[] = []
        const storage = new FakeStorage()
        const ledger = createClaimLedger({ storage })
        const { engine } = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(-1000) })],
            ledger: {
                claim: (key: string) => {
                    const acquired = ledger.claim(key)
                    if (acquired) order.push('claim')
                    return acquired
                }
            },
            onNotify: () => order.push('notify'),
            onConsume: () => order.push('consume')
        })

        engine.start()
        await flushMicrotasks()

        expect(order).toEqual(['claim', 'notify', 'consume'])
    })
})

describe('createReminderEngine · 补弹（AC4）', () => {
    it('AC4 关闭期间到期 ⇒ 重开补弹 1 次；再重开不再弹', async () => {
        const storage = new FakeStorage()
        const closedWhileDue = () => [makeTask({ id: 't1', remindAt: iso(-3_600_000) })]

        const first = setup({ tasks: closedWhileDue, ledger: createClaimLedger({ storage }) })
        first.engine.start()
        await flushMicrotasks()
        expect(first.notify).toHaveBeenCalledTimes(1)

        const second = setup({ tasks: closedWhileDue, ledger: createClaimLedger({ storage }) })
        second.engine.start()
        await flushMicrotasks()
        expect(second.notify).not.toHaveBeenCalled()
    })
})

describe('createReminderEngine · 准时（AC5，注入 now + 假定时器）', () => {
    it('AC5 常量口径：轮询基准间隔 = 10s（单一常量 ≤ 10_000）', () => {
        expect(REMINDER_SCAN_INTERVAL_MS).toBe(10_000)
        expect(REMINDER_SCAN_INTERVAL_MS).toBeLessThanOrEqual(10_000)
    })

    it('AC5 精确定时路径：3s 后到期 ⇒ 到点弹且偏差 ≤1s（允许 ≤200ms 提前量）', async () => {
        let firedAt: number | null = null
        const remindAt = BASE + 3000
        const { engine } = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(3000) })],
            onNotify: () => {
                firedAt = Date.now()
            }
        })

        engine.start()
        await flushMicrotasks()
        expect(firedAt).toBeNull()

        await vi.advanceTimersByTimeAsync(3000)
        await flushMicrotasks()

        expect(firedAt).not.toBeNull()
        const delay = (firedAt as unknown as number) - remindAt
        expect(delay).toBeLessThanOrEqual(1000)
        expect(delay).toBeGreaterThanOrEqual(-200)
    })

    it('AC5 轮询兜底路径：两次扫描之间才到期 ⇒ 下一个 10s 轮询内弹出（延迟 ≤10s）', async () => {
        const task = makeTask({ id: 't1', remindAt: iso(500) })
        let calls = 0
        let firedAt: number | null = null
        const { engine } = setup({
            // 首轮候选为空（该任务尚未进入候选）⇒ 不会设精确定时，只能靠轮询
            tasks: () => {
                calls += 1
                return calls === 1 ? [] : [task]
            },
            onNotify: () => {
                firedAt = Date.now()
            }
        })

        engine.start()
        await flushMicrotasks()
        expect(firedAt).toBeNull()

        await vi.advanceTimersByTimeAsync(REMINDER_SCAN_INTERVAL_MS)
        await flushMicrotasks()

        expect(firedAt).not.toBeNull()
        expect((firedAt as unknown as number) - (BASE + 500)).toBeLessThanOrEqual(10_000)
    })
})

describe('createReminderEngine · 异常与降级（AC6）', () => {
    it('AC6 本地库读失败 ⇒ 静默不崩、不落账、不派发；恢复后补弹', async () => {
        const key = `t1@${iso(-1000)}`
        let fail = true
        const { engine, notify, ledger } = setup({
            tasks: () => {
                if (fail) throw new Error('本地库不可读')
                return [makeTask({ id: 't1', remindAt: iso(-1000) })]
            }
        })

        engine.start()
        await flushMicrotasks()

        expect(notify).not.toHaveBeenCalled()
        expect(ledger.has(key)).toBe(false)

        fail = false
        await engine.rescan()

        expect(notify).toHaveBeenCalledTimes(1)
    })

    it('AC6 通知权限请求：多次 start 只请求 1 次；请求失败不影响应用内提醒', async () => {
        const requestNotificationPermission = vi.fn(async () => {
            throw new Error('denied')
        })
        const { engine, notify } = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(-1000) })],
            requestNotificationPermission
        })

        engine.start()
        engine.start()
        await flushMicrotasks()

        expect(requestNotificationPermission).toHaveBeenCalledTimes(1)
        expect(notify).toHaveBeenCalledTimes(1)
    })

    it('AC6 仓里不存在 Notification（浏览器不支持系统通知）⇒ 引擎不崩、仍派发应用内提醒', async () => {
        expect('Notification' in globalThis).toBe(false)
        const { engine, notify } = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(-1000) })]
        })

        expect(() => engine.start()).not.toThrow()
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(1)
    })
})

describe('createReminderEngine · 稍后与重复（AC8）', () => {
    it('AC8 Snooze 视为新条目：remindAt 变更 ⇒ 到点再弹 1 次（旧键不重复）', async () => {
        const task = makeTask({ id: 't1', remindAt: iso(-1000) })
        let current: ReminderTask = task
        const { engine, notify } = setup({ tasks: () => [current] })

        engine.start()
        await flushMicrotasks()
        expect(notify).toHaveBeenCalledTimes(1)

        // Snooze：本机 remindAt 被改写为 5 分钟后
        current = makeTask({ id: 't1', remindAt: iso(300_000) })
        await vi.advanceTimersByTimeAsync(300_000)
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(2)
        expect(notify.mock.calls[1]?.[0]).toMatchObject({ taskId: 't1' })
    })

    it('AC8 一次性提醒展示后消费 ⇒ consume(taskId, null)', async () => {
        const { engine, consume } = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(-1000), remindRepeat: 'none' })]
        })

        engine.start()
        await flushMicrotasks()

        expect(consume).toHaveBeenCalledWith('t1', null)
    })

    it('AC8 daily 展示后推进下一次 ⇒ consume(taskId, 下一次 ISO > now)', async () => {
        const { engine, consume } = setup({
            tasks: () => [
                makeTask({
                    id: 'd1',
                    remindRepeat: 'daily',
                    remindTime: '18:00',
                    remindAt: iso(-1000)
                })
            ]
        })

        engine.start()
        await flushMicrotasks()

        expect(consume).toHaveBeenCalledTimes(1)
        const [taskId, next] = consume.mock.calls[0] ?? []
        expect(taskId).toBe('d1')
        expect(next).not.toBeNull()
        expect(new Date(next as string).getTime()).toBeGreaterThan(Date.now())
    })

    it('AC8 next 越过 endAt ⇒ consume(taskId, null) 且不再派发', async () => {
        const { engine, notify, consume } = setup({
            tasks: () => [
                makeTask({
                    id: 'e1',
                    remindRepeat: 'daily',
                    remindTime: '18:00',
                    remindAt: iso(-1000),
                    endAt: iso(600_000) // 下一次远在其后
                })
            ]
        })

        engine.start()
        await flushMicrotasks()
        await vi.advanceTimersByTimeAsync(REMINDER_SCAN_INTERVAL_MS * 3)
        await flushMicrotasks()

        expect(consume).toHaveBeenCalledWith('e1', null)
        expect(notify).toHaveBeenCalledTimes(1)
    })
})

describe('createReminderEngine · 生命周期与幂等', () => {
    it('stop 后不再扫描 / 派发', async () => {
        const { engine, notify } = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(120_000) })]
        })

        engine.start()
        await flushMicrotasks()
        engine.stop()
        await vi.advanceTimersByTimeAsync(600_000)
        await flushMicrotasks()

        expect(notify).not.toHaveBeenCalled()
    })

    it('重复 rescan 同一到期项 ⇒ 仍只派发 1 次（幂等，账本兜住）', async () => {
        const { engine, notify } = setup({
            tasks: () => [makeTask({ id: 't1', remindAt: iso(-1000) })]
        })

        await engine.rescan()
        await engine.rescan()
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(1)
    })
})