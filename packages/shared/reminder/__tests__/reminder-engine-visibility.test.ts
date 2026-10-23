// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createReminderEngine, type ReminderTask } from '@nao-todo/shared/reminder'
import { flushMicrotasks, makeTask } from './reminder-harness'

/**
 * T525 · 引擎可见性 / 回前台补扫（AC4 · AC5 隐藏态口径 · NFR）
 *
 * @description 口径（PRD §六 NFR + 报告 §4 AC-B）：**仅页面可见时轮询**；隐藏即停，
 *              由 `visibilitychange → visible` 触发补扫，**≤2s** 内弹出隐藏期间到期项。
 *              隐藏态不承诺准时（浏览器节流），故本文件不断言「隐藏时到点即弹」。
 *              用假定时器 + 覆写 `document.visibilityState`，⛔ 不用 sleep / 真实时钟。
 */

const BASE = new Date('2026-10-23T10:00:00.000Z').getTime()
const iso = (offsetMs: number): string => new Date(BASE + offsetMs).toISOString()

let visibility: 'visible' | 'hidden' = 'visible'

const setVisibility = (next: 'visible' | 'hidden'): void => {
    visibility = next
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibility
    })
    document.dispatchEvent(new Event('visibilitychange'))
}

const setup = (tasks: () => readonly ReminderTask[]) => {
    const delivered = new Set<string>()
    const notify = vi.fn()
    const engine = createReminderEngine({
        listCandidates: async () => tasks(),
        now: () => Date.now(),
        ledger: {
            claim: (key: string) => {
                if (delivered.has(key)) return false
                delivered.add(key)
                return true
            }
        },
        notify
    })
    return { engine, notify }
}

beforeEach(() => {
    vi.useFakeTimers({ now: BASE })
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibility
    })
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('createReminderEngine · 可见性（AC4 / NFR §六）', () => {
    it('隐藏即停轮询：隐藏期间到期的条目不在隐藏态弹出', async () => {
        let due: ReminderTask[] = []
        const { engine, notify } = setup(() => due)

        engine.start()
        await flushMicrotasks()

        setVisibility('hidden')
        // 隐藏期间数据侧出现到期条目（本机同步 / 首次解锁补扫等）
        due = [makeTask({ id: 't1', remindAt: iso(-1000) })]
        await vi.advanceTimersByTimeAsync(60_000)
        await flushMicrotasks()

        expect(notify).not.toHaveBeenCalled()
    })

    it('回到前台 ≤2s 内补扫并弹出隐藏期间到期项（AC4）', async () => {
        let due: ReminderTask[] = []
        const { engine, notify } = setup(() => due)

        engine.start()
        await flushMicrotasks()

        setVisibility('hidden')
        due = [makeTask({ id: 't1', remindAt: iso(-1000) })]
        await vi.advanceTimersByTimeAsync(60_000)
        await flushMicrotasks()
        expect(notify).not.toHaveBeenCalled()

        setVisibility('visible')
        await vi.advanceTimersByTimeAsync(2000)
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(1)
    })

    it('补扫幂等：再隐藏 → 再回前台，同一条不再补弹（AC4 + AC3）', async () => {
        const due: ReminderTask[] = [makeTask({ id: 't1', remindAt: iso(-1000) })]
        const { engine, notify } = setup(() => due)

        engine.start()
        await flushMicrotasks()
        expect(notify).toHaveBeenCalledTimes(1)

        setVisibility('hidden')
        await vi.advanceTimersByTimeAsync(60_000)
        setVisibility('visible')
        await vi.advanceTimersByTimeAsync(2000)
        await flushMicrotasks()

        expect(notify).toHaveBeenCalledTimes(1)
    })
})