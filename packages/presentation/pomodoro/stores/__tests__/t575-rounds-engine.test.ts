// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { usePomodoroSessionStore, usePomodoroTimerStore } from '..'

/**
 * T575 ③ 轮次计数语义 + `DEF-111` 长休 off-by-one（AC9 / AC10 / AC11）
 *
 * @description 全部断言走**引擎可观测行为**（`phase` 时序）与计数暴露面 `completedRounds`，
 *              不依赖组件 DOM（组件结构 / 溢出属用户视觉勾选清单 ⑥）。
 *
 * 计数语义（PRD §五「轮次」· D5）：
 *   - 仅「**专注自然完成**」计数 +1；跳过专注 / 结束专注 / 取消专注 **均不计数**；
 *   - break / longBreak 完成（含跳过休息）**也不计数**；
 *   - 专注自然完成后若「本周期已完成数 >= M」⇒ 长休 + 周期计数归零。
 *
 * `DEF-111`（当前实现的错）：计数点在 **break 完成**、而长休判定在 **focus 完成** ⇒
 *   `M=4` 时第 4 次专注结束后仍是短休（长休实际落在第 5 次之后）；`M=1` 时第 1 次专注结束后也仍是短休。
 *   本文件的 `AC9` / `AC10` 用例就是该缺陷的最小复现。
 *
 * ⚠️ 契约名：计数暴露面 = `completedRounds`（`number`）。指示器视图模型的同名字段见
 *    `docs/qa/2026-10-29-T575-test-contracts.md` §3。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§一 #3 · §五 轮次 · §七 AC9–AC11 · §九 D5）
 */

const FOCUS_S = 25 * 60
const BREAK_S = 5 * 60
const LONG_BREAK_S = 15 * 60

let timer: ReturnType<typeof usePomodoroTimerStore>
let session: ReturnType<typeof usePomodoroSessionStore>

/** 计数暴露面（当前实现未暴露 ⇒ `undefined`，用例据此判红） */
const roundsOf = (): number | undefined =>
    (timer as unknown as { completedRounds?: number }).completedRounds

/** 从 idle 起跑并让专注自然完成（⇒ 进入短休 / 长休） */
const completeFocus = () => {
    timer.start()
    vi.advanceTimersByTime(FOCUS_S * 1000 + 500)
}

/** 让当前休息阶段自然完成（⇒ 回 idle，默认不自动开始下一轮） */
const completeBreak = (seconds = BREAK_S) => {
    vi.advanceTimersByTime(seconds * 1000 + 500)
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0, 0))
    localStorage.clear()

    setActivePinia(createPinia())
    session = usePomodoroSessionStore()
    session.setFocusDuration(FOCUS_S)
    session.setBreakDuration(BREAK_S)
    session.setLongBreakDuration(LONG_BREAK_S)
    session.setAutoRest(true)
    session.setAutoStartNextFocusSession(false)
    session.setSessionsUntilLongBreak(4)
    timer = usePomodoroTimerStore()
    timer.updateConfig()
    timer.setCreateRecordFn(vi.fn(async () => [[], null] as never) as never)
})

afterEach(() => {
    timer.destroy()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe('T575 ③ AC9 / DEF-111：M=4 时第 4 次专注自然完成后进入长休', () => {
    it('AC9 逐轮推进：前 3 次 ⇒ 短休（计数 1/2/3），第 4 次 ⇒ 长休且周期归零', () => {
        for (let round = 1; round <= 3; round += 1) {
            completeFocus()
            expect(timer.phase, `第 ${round} 次专注完成后应进入短休`).toBe('break')
            expect(roundsOf(), `第 ${round} 次专注完成后计数应为 ${round}`).toBe(round)
            completeBreak()
            expect(timer.phase).toBe('idle')
        }

        completeFocus()
        expect(timer.phase, 'DEF-111：第 4 次专注自然完成后必须进入长休').toBe('longBreak')
        expect(roundsOf(), '长休触发时周期计数应归零').toBe(0)
    })

    it('AC9 长休结束后重新计数：再跑 4 次专注仍在第 4 次进入长休', () => {
        for (let round = 1; round <= 4; round += 1) {
            completeFocus()
            if (round < 4) completeBreak()
        }
        expect(timer.phase).toBe('longBreak')
        completeBreak(LONG_BREAK_S)
        expect(timer.phase).toBe('idle')

        for (let round = 1; round <= 3; round += 1) {
            completeFocus()
            expect(timer.phase).toBe('break')
            completeBreak()
        }
        completeFocus()
        expect(timer.phase, '新周期第 4 次专注后同样进入长休').toBe('longBreak')
    })
})

describe('T575 ③ AC10 边界：M=1 时首次专注完成即长休', () => {
    it('AC10 M=1 ⇒ 第 1 次专注自然完成后直接进入长休（DEF-111 最小复现）', () => {
        session.setSessionsUntilLongBreak(1)

        completeFocus()

        expect(timer.phase, 'M=1 时第 1 次专注自然完成后必须进入长休').toBe('longBreak')
        expect(roundsOf()).toBe(0)
    })

    it('AC10 M=10 ⇒ 第 9 次后仍是短休，第 10 次才长休', () => {
        session.setSessionsUntilLongBreak(10)

        for (let round = 1; round <= 9; round += 1) {
            completeFocus()
            expect(timer.phase, `M=10：第 ${round} 次后应为短休`).toBe('break')
            expect(roundsOf()).toBe(round)
            completeBreak()
        }

        completeFocus()
        expect(timer.phase, 'M=10：第 10 次专注后进入长休').toBe('longBreak')
    })
})

describe('T575 ③ AC11 负向闭环：非自然完成不计数', () => {
    it('AC11 自然完成 ⇒ 计数 +1', () => {
        completeFocus()
        expect(roundsOf()).toBe(1)
    })

    it('AC11 跳过专注（skip）⇒ 计数不变（0），且进入休息阶段', () => {
        timer.start()
        vi.advanceTimersByTime(60_000)
        timer.skip()

        expect(timer.phase).toBe('break')
        expect(roundsOf(), '跳过专注不得推进轮次').toBe(0)
    })

    it('AC11 结束专注（end）⇒ 计数不变（0），回 idle', () => {
        timer.start()
        vi.advanceTimersByTime(60_000)
        timer.end()

        expect(timer.phase).toBe('idle')
        expect(roundsOf(), '结束专注不得推进轮次').toBe(0)
    })

    it('AC11 取消专注（reset）⇒ 计数不变（0）', () => {
        timer.start()
        vi.advanceTimersByTime(60_000)
        timer.reset()

        expect(timer.phase).toBe('idle')
        expect(roundsOf()).toBe(0)
    })

    it('AC11 跳过休息（skip on break）不计数：M=2 时第 2 次专注完成仍进入长休', () => {
        session.setSessionsUntilLongBreak(2)

        completeFocus() // 计数 1 ⇒ 短休
        expect(timer.phase).toBe('break')
        expect(roundsOf()).toBe(1)

        timer.skip() // 跳过休息：不得计数（原实现在此处 +1）
        expect(timer.phase).toBe('idle')
        expect(roundsOf(), '跳过休息不得推进轮次').toBe(1)

        completeFocus() // 第 2 次专注自然完成 ⇒ 计数 2 >= M ⇒ 长休
        expect(timer.phase, 'M=2：第 2 次专注自然完成必须进入长休').toBe('longBreak')
    })
})