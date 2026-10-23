// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    createClaimLedger,
    createReminderEngine,
    type ReminderTask
} from '@nao-todo/shared/reminder'
import { FakeStorage, flushMicrotasks, makeTask } from './reminder-harness'

/**
 * T527 · 跨标签互斥（AC3 · 报告 Q5）
 *
 * @description 同源多标签经 `navigator.locks`（`ifAvailable`）互斥：抢不到锁的标签本轮跳过，
 *              由持锁标签扫描；**账本 `claim` 仍是唯一性最终判据**（无 Locks ⇒ CAS 降级）。
 *              本文件只断言「互斥接线 + 降级不丢提醒」，判定口径由 `collect-due-reminders` 用例覆盖。
 */

const BASE = new Date('2026-10-23T10:00:00.000Z').getTime()
const iso = (offsetMs: number): string => new Date(BASE + offsetMs).toISOString()

type LockCallback = (lock: unknown) => Promise<void>

type FakeLockManager = {
    request: (
        name: string,
        options: { ifAvailable: boolean },
        callback: LockCallback
    ) => Promise<void>
}

/** 串行锁管理器：`ifAvailable` 抢不到 ⇒ 回调收到 `null`（与 Web Locks 语义一致） */
const createFakeLocks = (): FakeLockManager => {
    let held = false
    return {
        async request(_name, _options, callback) {
            if (held) {
                await callback(null)
                return
            }
            held = true
            try {
                await callback({ name: 'nao-todo:reminder-scan' })
            } finally {
                held = false
            }
        }
    }
}

const stubLocks = (locks: unknown): void => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: locks })
}

const setup = (tasks: () => readonly ReminderTask[], storage: FakeStorage, onScan: () => void) => {
    const notify = vi.fn()
    const engine = createReminderEngine({
        listCandidates: async () => {
            onScan()
            return tasks()
        },
        now: () => Date.now(),
        ledger: createClaimLedger({ storage }),
        notify
    })
    return { engine, notify }
}

beforeEach(() => {
    vi.useFakeTimers({ now: BASE })
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'locks')
})

describe('createReminderEngine · 跨标签互斥（AC3 / Q5）', () => {
    it('AC3 两标签并发扫描：抢不到锁的标签本轮跳过 ⇒ 合计恰好 1 次', async () => {
        stubLocks(createFakeLocks())
        const storage = new FakeStorage()
        const due = () => [makeTask({ id: 't1', remindAt: iso(-1000) })]
        let scans = 0
        const tabs = [
            setup(due, storage, () => (scans += 1)),
            setup(due, storage, () => (scans += 1))
        ]

        for (const tab of tabs) tab.engine.start()
        await flushMicrotasks()

        // 互斥证据：只有持锁标签真正扫描（抢不到锁的一方本轮跳过）
        expect(scans).toBe(1)
        const total = tabs.reduce((sum, tab) => sum + tab.notify.mock.calls.length, 0)
        expect(total).toBe(1)
    })

    it('Locks 抛错 ⇒ 降级 CAS：提醒照常弹出（不得漏提醒）', async () => {
        stubLocks({
            request: async () => {
                throw new Error('locks unavailable')
            }
        })
        const { engine, notify } = setup(
            () => [makeTask({ id: 't1', remindAt: iso(-1000) })],
            new FakeStorage(),
            () => {}
        )

        engine.start()
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(1)
    })
})