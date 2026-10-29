// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { loadImpl } from './impl-seam'

/**
 * T575 ③ 轮次指示器 —— 视图模型（AC9 / AC10 / AC11 / AC12 三态可辨）
 *
 * @description 指示器是**纯展示 + 纯计算**（PRD §五「轮次」/ §六 NFR），因此把「圆点填充数 + 文字标签」
 *              固化为一个纯函数用例，不依赖组件挂载（组件结构 / 间距 / 溢出属用户视觉勾选清单 ⑥）。
 *
 * 期望实现落点：`packages/presentation/pomodoro/utils/pomodoro-rounds.ts`
 * 契约（见 `docs/qa/2026-10-29-T575-test-contracts.md` §3）：
 *   - `resolveRoundIndicator({ phase, completedRounds, sessionsUntilLongBreak })`
 *       → `{ total, filled, label, longBreakUpcoming }`
 *   - `total` = 圆点总数 = M；`filled` = 实心圆点数；`label` = 文字标签（三态兜底，**不得仅靠颜色**）
 *
 * 裁定②（PM 2026-10-29 · D11）：**以 AC9 为准 —— 实心数恒等于「已完成数」，不分阶段、M=1 无特例**
 *    （原 §五「M=1 显示 1 个实心」已作废并回填 PRD；**T580 起 `idle` 的实心随已完成数，见下**）。
 *    故 M=1 且 0 轮：idle/focus ⇒ ○、
 *    break（该轮已完成）⇒ ●；文字分别为「共 1 轮一轮长休」/「第 1/1 轮 · 本轮结束后长休」/「休息中 · 已完成 1/1」。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 轮次 · §七 AC9–AC12 · §九 D3）
 * @see docs/prds/2026-10-29-pomodoro-rounds-semantics.md（T580 · §五 显示规则 · §七 AC1–AC4 · §九 D15）
 *
 * ⚠️ T580 口径修正（`DEF-112`；D15 取代上批 D11 的 idle 部分）：**`idle` 同样遵守「实心数 = 已完成数」** ——
 *    引擎在「结束专注」后**刻意保留** `completedRounds`，指示器不得画成 0 实心（原「idle 恒 0」断言已作废）。
 *    `idle` 文案随之分档：0 轮 ⇒ 中性「共 M 轮一轮长休」；0 < N < M ⇒「本周期已完成 N 轮 · 再 X 轮长休」
 *    （X = M − N）；满周期档（N = M）**不应出现**（实现须先归零，用例只守「不产出该档」）。
 *    `longBreak` 仍为 0 实心 +「长休息 · 新周期」（回归项，不得被本批改坏）。
 */

type Phase = 'idle' | 'focus' | 'break' | 'longBreak'

type RoundInput = { phase: Phase; completedRounds: number; sessionsUntilLongBreak: number }

type RoundView = {
    total: number
    filled: number
    label: string
    longBreakUpcoming: boolean
}

interface RoundsModule {
    resolveRoundIndicator: (input: RoundInput) => RoundView
}

const MODULE = 'packages/presentation/pomodoro/utils/pomodoro-rounds.ts'

const load = (ac: string): Promise<RoundsModule> =>
    loadImpl<RoundsModule>('../pomodoro-rounds', MODULE, ['resolveRoundIndicator'], ac)

describe('T575 ③ AC9 主路径（M=4）', () => {
    it('AC9 idle ⇒ 共 4 轮一轮长休，无圆点填充', async () => {
        const { resolveRoundIndicator } = await load('AC9')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 0,
            sessionsUntilLongBreak: 4
        })
        expect(view).toEqual({
            total: 4,
            filled: 0,
            label: '共 4 轮一轮长休',
            longBreakUpcoming: false
        })
    })

    it('AC9 完成第 1 次专注并开始第 2 次 ⇒ ●○○○ +「第 2/4 轮」', async () => {
        const { resolveRoundIndicator } = await load('AC9')
        const view = resolveRoundIndicator({
            phase: 'focus',
            completedRounds: 1,
            sessionsUntilLongBreak: 4
        })
        expect(view.total).toBe(4)
        expect(view.filled).toBe(1)
        expect(view.label).toBe('第 2/4 轮')
        expect(view.longBreakUpcoming).toBe(false)
    })

    it('AC9 完成第 3 次后（第 4 轮进行中）⇒ ●●●○ +「本轮结束后长休」', async () => {
        const { resolveRoundIndicator } = await load('AC9')
        const view = resolveRoundIndicator({
            phase: 'focus',
            completedRounds: 3,
            sessionsUntilLongBreak: 4
        })
        expect(view.filled).toBe(3)
        expect(view.label).toBe('第 4/4 轮 · 本轮结束后长休')
        expect(view.longBreakUpcoming).toBe(true)
    })

    it('AC9 短休息中 ⇒「休息中 · 已完成 N/M」', async () => {
        const { resolveRoundIndicator } = await load('AC9')
        const view = resolveRoundIndicator({
            phase: 'break',
            completedRounds: 1,
            sessionsUntilLongBreak: 4
        })
        expect(view.filled).toBe(1)
        expect(view.label).toBe('休息中 · 已完成 1/4')
    })

    it('AC9 长休息中 ⇒「长休息 · 新周期」且周期计数已归零（无实心）', async () => {
        const { resolveRoundIndicator } = await load('AC9')
        const view = resolveRoundIndicator({
            phase: 'longBreak',
            completedRounds: 0,
            sessionsUntilLongBreak: 4
        })
        expect(view.filled).toBe(0)
        expect(view.label).toBe('长休息 · 新周期')
        expect(view.longBreakUpcoming).toBe(false)
    })
})

describe('T575 ③ AC10 边界（M=1 / M=10）', () => {
    // 裁定②（PM 2026-10-29 · D11）：实心数**恒等于已完成数**，M=1 无特例（原 §五「M=1 显示 1 实心」作废）
    it('AC10 M=1 处于 idle ⇒ ○ 且「共 1 轮一轮长休」', async () => {
        const { resolveRoundIndicator } = await load('AC10')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 0,
            sessionsUntilLongBreak: 1
        })
        expect(view.total).toBe(1)
        expect(view.filled).toBe(0)
        expect(view.label).toBe('共 1 轮一轮长休')
        expect(view.longBreakUpcoming).toBe(false)
    })

    it('AC10 M=1 专注进行中（本轮即最后一轮）⇒ ○（0 已完成）+「第 1/1 轮 · 本轮结束后长休」', async () => {
        const { resolveRoundIndicator } = await load('AC10')
        const view = resolveRoundIndicator({
            phase: 'focus',
            completedRounds: 0,
            sessionsUntilLongBreak: 1
        })
        expect(view.total).toBe(1)
        expect(view.filled).toBe(0)
        expect(view.label).toBe('第 1/1 轮 · 本轮结束后长休')
        expect(view.longBreakUpcoming).toBe(true)
    })

    it('AC10 M=1 休息中（该轮已完成）⇒ ● 且「休息中 · 已完成 1/1」', async () => {
        const { resolveRoundIndicator } = await load('AC10')
        const view = resolveRoundIndicator({
            phase: 'break',
            completedRounds: 1,
            sessionsUntilLongBreak: 1
        })
        expect(view.total).toBe(1)
        expect(view.filled).toBe(1)
        expect(view.label).toBe('休息中 · 已完成 1/1')
        expect(view.longBreakUpcoming).toBe(false)
    })

    it('AC10 M=10 ⇒ 圆点总数 10 且不越界（filled ≤ total）', async () => {
        const { resolveRoundIndicator } = await load('AC10')
        const view = resolveRoundIndicator({
            phase: 'focus',
            completedRounds: 5,
            sessionsUntilLongBreak: 10
        })
        expect(view.total).toBe(10)
        expect(view.filled).toBe(5)
        expect(view.label).toBe('第 6/10 轮')
        expect(view.filled).toBeLessThanOrEqual(view.total)
    })

    it('AC10 M=10 处于 idle ⇒「共 10 轮一轮长休」', async () => {
        const { resolveRoundIndicator } = await load('AC10')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 0,
            sessionsUntilLongBreak: 10
        })
        expect(view.total).toBe(10)
        expect(view.filled).toBe(0)
        expect(view.label).toBe('共 10 轮一轮长休')
    })
})

describe('T575 ③ AC11 负向闭环：非自然完成不推进轮次（语义一致性）', () => {
    it('AC11 跳过专注后循环计数不变 ⇒ 指示器仍为「第 N/M 轮」口径（不得出现第 5/4 轮）', async () => {
        const { resolveRoundIndicator } = await load('AC11')
        const view = resolveRoundIndicator({
            phase: 'focus',
            completedRounds: 3,
            sessionsUntilLongBreak: 4
        })
        const n = Number(view.label.match(/第 (\d+)\//)?.[1])
        expect(n).toBeLessThanOrEqual(4)
        expect(n).toBe(4)
    })

    it('AC11 计数越界防守：completedRounds 不得让标签出现「第 M+1 轮」', async () => {
        const { resolveRoundIndicator } = await load('AC11')
        const overflow = resolveRoundIndicator({
            phase: 'break',
            completedRounds: 7,
            sessionsUntilLongBreak: 4
        })
        expect(overflow.filled).toBeLessThanOrEqual(overflow.total)
        expect(overflow.label).not.toContain('第 8/4 轮')
    })
})

describe('T575 ③ AC12 三态可辨（不依赖颜色）', () => {
    it('AC12 圆点三态由「实心数 / 空心数 / 文字标签」表达（去色后仍可分）', async () => {
        const { resolveRoundIndicator } = await load('AC12')
        const view = resolveRoundIndicator({
            phase: 'focus',
            completedRounds: 2,
            sessionsUntilLongBreak: 4
        })
        // 空心数 = total - filled（结构性区分，不依赖任何颜色信息）
        expect(view.total - view.filled).toBe(2)
        // 文字标签兜底（非空且含轮次信息）
        expect(view.label.length).toBeGreaterThan(0)
        expect(view.label).toContain('/4')
    })

    it('AC12 纯计算无副作用：两次调用结果一致，且不修改入参', async () => {
        const { resolveRoundIndicator } = await load('AC12')
        const input: RoundInput = Object.freeze({
            phase: 'focus',
            completedRounds: 2,
            sessionsUntilLongBreak: 4
        }) as RoundInput
        const first = resolveRoundIndicator(input)
        const second = resolveRoundIndicator(input)
        expect(first).toEqual(second)
        expect(input).toEqual({
            phase: 'focus',
            completedRounds: 2,
            sessionsUntilLongBreak: 4
        })
    })
})
describe('T580 ① idle 口径修正（DEF-112）：实心 = 本周期已完成轮数，文案分档', () => {
    it('T580 已完成 0 轮 ⇒ ○○○○ + 中性「共 4 轮一轮长休」（不暗示进度）', async () => {
        const { resolveRoundIndicator } = await load('AC3')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 0,
            sessionsUntilLongBreak: 4
        })
        expect(view).toEqual({
            total: 4,
            filled: 0,
            label: '共 4 轮一轮长休',
            longBreakUpcoming: false
        })
    })

    it('T580 已完成 1 轮 ⇒ ●○○○ +「本周期已完成 1 轮 · 再 3 轮长休」', async () => {
        const { resolveRoundIndicator } = await load('AC1')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 1,
            sessionsUntilLongBreak: 4
        })
        expect(view).toEqual({
            total: 4,
            filled: 1,
            label: '本周期已完成 1 轮 · 再 3 轮长休',
            longBreakUpcoming: false
        })
    })

    it('T580 已完成 2 轮（DEF-112 用户场景）⇒ ●●○○ +「本周期已完成 2 轮 · 再 2 轮长休」', async () => {
        const { resolveRoundIndicator } = await load('AC2')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 2,
            sessionsUntilLongBreak: 4
        })
        expect(view.filled).toBe(2)
        expect(view.label).toBe('本周期已完成 2 轮 · 再 2 轮长休')
        // 实心数恒等于已完成数（唯一规则，不分阶段）
        expect(view.total).toBe(4)
    })

    it('T580 已完成 3 轮（AC1 主路径）⇒ ●●●○ +「本周期已完成 3 轮 · 再 1 轮长休」', async () => {
        const { resolveRoundIndicator } = await load('AC1')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 3,
            sessionsUntilLongBreak: 4
        })
        expect(view).toEqual({
            total: 4,
            filled: 3,
            label: '本周期已完成 3 轮 · 再 1 轮长休',
            longBreakUpcoming: false
        })
    })

    it('T580 通用 M=10：已完成 6 轮 ⇒ 再 4 轮长休（X = M − N，不写死 M=4）', async () => {
        const { resolveRoundIndicator } = await load('AC1')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 6,
            sessionsUntilLongBreak: 10
        })
        expect(view.total).toBe(10)
        expect(view.filled).toBe(6)
        expect(view.label).toBe('本周期已完成 6 轮 · 再 4 轮长休')
    })

    it('T580 满周期档守门：idle 且已完成 = M ⇒ 不得产出「再 0 轮」档（实现须先归零）', async () => {
        const { resolveRoundIndicator } = await load('AC1')
        const view = resolveRoundIndicator({
            phase: 'idle',
            completedRounds: 4,
            sessionsUntilLongBreak: 4
        })
        // 该档只可能在 autoRest=false 的短暂态出现；实现须先归零 ⇒ 用例守「不产出该档」
        expect(view.filled).toBeLessThanOrEqual(view.total)
        expect(view.label).not.toContain('再 0 轮')
        expect(view.label).not.toContain('再 0 轮长休')
    })

    it('T580 回归：longBreak 恒 0 实心 +「长休息 · 新周期」（即使引擎仍持旧周期计数）', async () => {
        const { resolveRoundIndicator } = await load('AC4')
        const view = resolveRoundIndicator({
            phase: 'longBreak',
            completedRounds: 3,
            sessionsUntilLongBreak: 4
        })
        expect(view.filled).toBe(0)
        expect(view.label).toBe('长休息 · 新周期')
        expect(view.longBreakUpcoming).toBe(false)
    })
})