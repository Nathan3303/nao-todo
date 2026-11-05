import { describe, expect, it } from 'vite-plus/test'
import {
    AUTO_REFRESH_INTERVAL_MS,
    createAutoRefreshController,
    type AutoRefreshController,
    type AutoRefreshPullOutcome,
    type AutoRefreshTimerHandle,
    type AutoRefreshTrigger
} from '../auto-refresh'

/**
 * T654 · 自动刷新门控层（AC1 / AC3 / AC4 / AC5 / AC6 / AC9 / AC10）
 *
 * @description 纯逻辑层用**可控定时器**驱动（不依赖 fake timers / 真实等待）：
 *              断言「何时会调一次既有拉取入口」，不断言拉取内部行为
 *              （拉取后的数据可见与新鲜度由 `t654-ac1-periodic-refresh.test.ts` 用真 `SyncService` 覆盖）。
 * @see docs/prds/2026-11-05-sync-perception-polling.md（R-4 / R-5 / R-9 / AC1–AC10）
 */

type Scheduled = { fn: () => void; delayMs: number; dueAt: number }

/** 让异步链（`await pull()` 等微任务）走完（真实 setTimeout，不受被注入定时器影响） */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const createClock = () => {
    let now = 0
    let seq = 0
    const tasks = new Map<number, Scheduled>()
    const delays: number[] = []
    return {
        delays,
        get pending(): number {
            return tasks.size
        },
        setTimeout: (fn: () => void, delayMs: number): AutoRefreshTimerHandle => {
            seq += 1
            delays.push(delayMs)
            tasks.set(seq, { fn, delayMs, dueAt: now + delayMs })
            return seq
        },
        clearTimeout: (handle: AutoRefreshTimerHandle): void => {
            tasks.delete(handle as number)
        },
        /** 推进时钟并依次触发到期任务（每次触发后让异步链走完） */
        advance: async (ms: number): Promise<void> => {
            now += ms
            for (let guard = 0; guard < 100; guard += 1) {
                const next = [...tasks.entries()]
                    .filter(([, task]) => task.dueAt <= now)
                    .sort((a, b) => a[1].dueAt - b[1].dueAt)[0]
                if (!next) {
                    await flush()
                    const stillDue = [...tasks.values()].some((task) => task.dueAt <= now)
                    if (!stillDue) return
                    continue
                }
                tasks.delete(next[0])
                next[1].fn()
                await flush()
            }
            throw new Error('advance guard 触发：定时器调度疑似死循环')
        }
    }
}

const createHarness = (
    options: { visible?: boolean; offline?: boolean; pending?: boolean } = {}
): {
    controller: AutoRefreshController
    clock: ReturnType<typeof createClock>
    pulls: AutoRefreshTrigger[]
    setPending: (pending: boolean) => void
    setOutcome: (outcome: AutoRefreshPullOutcome) => void
} => {
    let pending = options.pending ?? false
    let outcome: AutoRefreshPullOutcome = { ok: true }
    const pulls: AutoRefreshTrigger[] = []
    const clock = createClock()
    const controller = createAutoRefreshController({
        pull: async (trigger) => {
            pulls.push(trigger)
            return outcome
        },
        hasPendingLocalWrites: async () => pending,
        isVisible: () => options.visible ?? true,
        isOffline: () => options.offline ?? false,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
    })
    return {
        controller,
        clock,
        pulls,
        setPending: (next) => {
            pending = next
        },
        setOutcome: (next) => {
            outcome = next
        }
    }
}

describe('T654 · AC1/AC9 可见空闲周期（30s，≤2 次/分）', () => {
    it('AC1 周期为 30s；可见空闲 60s 内**恰好 2 次**拉取（AC9 请求预算）', async () => {
        const h = createHarness()
        h.controller.start()
        expect(h.clock.delays).toEqual([AUTO_REFRESH_INTERVAL_MS])

        await h.clock.advance(30_000)
        await h.clock.advance(30_000)

        expect(h.pulls).toEqual(['periodic', 'periodic'])
        expect(h.pulls).toHaveLength(2) // ≤2 次/分
    })

    it('AC1 启动时**不**额外拉取（首次拉取仍由既有 syncService.start 负责，避免请求翻倍）', () => {
        const h = createHarness()
        h.controller.start()
        expect(h.pulls).toEqual([])
    })
})

describe('T654 · AC3 失败退避（5s→10s→30s→60s→120s 封顶，成功清零）', () => {
    it('连续失败按既有退避表递增并封顶 120s；恢复成功回到 30s', async () => {
        const h = createHarness()
        h.setOutcome({ ok: false })
        h.controller.start()

        await h.clock.advance(30_000) // 首次周期（30s）失败
        expect(h.clock.delays).toEqual([30_000, 5_000])

        await h.clock.advance(5_000) // 失败 2 → 10s
        await h.clock.advance(10_000) // 失败 3 → 30s
        await h.clock.advance(30_000) // 失败 4 → 60s
        await h.clock.advance(60_000) // 失败 5 → 120s
        await h.clock.advance(120_000) // 失败 6 → 仍 120s（封顶）
        expect(h.clock.delays).toEqual([30_000, 5_000, 10_000, 30_000, 60_000, 120_000, 120_000])
        expect(h.controller.getFailureCount()).toBe(6)

        h.setOutcome({ ok: true })
        await h.clock.advance(120_000)
        expect(h.controller.getFailureCount()).toBe(0)
        expect(h.clock.delays.at(-1)).toBe(AUTO_REFRESH_INTERVAL_MS)
    })
})

describe('T654 · AC4 离线 / 凭证失效', () => {
    it('离线 ⇒ 不建定时器、零请求；恢复联网 ⇒ 立即拉一次', async () => {
        const h = createHarness({ offline: true })
        h.controller.start()
        expect(h.clock.pending).toBe(0)

        await h.clock.advance(120_000)
        expect(h.pulls).toEqual([])

        h.controller.setOffline(false)
        await flush()
        expect(h.pulls).toEqual(['online'])
    })

    it('离线期间即使回到可见也不拉（隐藏/离线优先级更高）', async () => {
        const h = createHarness({ offline: true })
        h.controller.start()
        h.controller.setVisible(true)
        await flush()
        expect(h.pulls).toEqual([])
        expect(h.clock.pending).toBe(0)
    })

    it('凭证失效 ⇒ 立即停用（清定时器、不再周期重试）', async () => {
        const h = createHarness()
        h.setOutcome({ ok: false, stop: true })
        h.controller.start()

        await h.clock.advance(30_000)
        expect(h.pulls).toHaveLength(1)
        expect(h.controller.isDisposed()).toBe(true)
        expect(h.clock.pending).toBe(0)

        await h.clock.advance(600_000)
        expect(h.pulls).toHaveLength(1)
    })
})

describe('T654 · AC5 可见性门控（隐藏 = 零请求、零定时器；显示 = 立即拉）', () => {
    it('隐藏 ⇒ 清定时器；隐藏期间推进 5 分钟零请求', async () => {
        const h = createHarness()
        h.controller.start()
        expect(h.clock.pending).toBe(1)

        h.controller.setVisible(false)
        expect(h.clock.pending).toBe(0)

        await h.clock.advance(300_000)
        expect(h.pulls).toEqual([])
    })

    it('回到可见 ⇒ 立即拉一次（不等 30s），随后恢复 30s 周期', async () => {
        const h = createHarness()
        h.controller.start()
        h.controller.setVisible(false)
        await h.clock.advance(300_000)

        h.controller.setVisible(true)
        await flush()
        expect(h.pulls).toEqual(['visible'])
        expect(h.clock.delays.at(-1)).toBe(AUTO_REFRESH_INTERVAL_MS)

        await h.clock.advance(30_000)
        expect(h.pulls).toEqual(['visible', 'periodic'])
    })
})

describe('T654 · AC6 脏队列门控', () => {
    it('队列非空 ⇒ 周期拉取不发生；清空后 ≤1 周期恢复', async () => {
        const h = createHarness({ pending: true })
        h.controller.start()

        await h.clock.advance(30_000)
        expect(h.pulls).toEqual([])
        expect(h.clock.delays.at(-1)).toBe(AUTO_REFRESH_INTERVAL_MS)

        h.setPending(false)
        await h.clock.advance(30_000)
        expect(h.pulls).toEqual(['periodic'])
    })

    it('脏队列不饿死用户动作：回到可见 / 恢复联网仍可拉（R-4）', async () => {
        const h = createHarness({ pending: true })
        h.controller.start()

        h.controller.setVisible(true)
        await flush()
        h.controller.setOffline(false)
        await flush()

        expect(h.pulls).toEqual(['visible', 'online'])
    })
})

describe('T654 · AC10 资源清理', () => {
    it('dispose ⇒ 定时器清空，之后再推进也零请求', async () => {
        const h = createHarness()
        h.controller.start()
        expect(h.clock.pending).toBe(1)

        h.controller.dispose()
        expect(h.clock.pending).toBe(0)

        await h.clock.advance(600_000)
        expect(h.pulls).toEqual([])
    })

    it('dispose 后可见性/离线信号不再触发拉取', async () => {
        const h = createHarness()
        h.controller.start()
        h.controller.dispose()

        h.controller.setVisible(false)
        h.controller.setVisible(true)
        h.controller.setOffline(false)
        await flush()
        expect(h.pulls).toEqual([])
    })
})

describe('T654 · 定时器无界防护', () => {
    it('任一时刻最多一个定时器（调度即先清旧，不叠加）', async () => {
        const h = createHarness()
        h.controller.start()
        for (let i = 0; i < 5; i += 1) {
            h.controller.setVisible(true)
            await flush()
        }
        expect(h.clock.pending).toBe(1)
    })
})