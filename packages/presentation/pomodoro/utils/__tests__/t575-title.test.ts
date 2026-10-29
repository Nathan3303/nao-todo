// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { loadImpl } from './impl-seam'

/**
 * T575 ② 页签标题计时 —— 文案格式 + 写入节流 + 复位（AC5 / AC6）
 *
 * @description 两级固化为用例：
 *              ① `formatPomodoroTitle`（**文案单源**，PRD §五「页签标题」+ PM 决策 **D8/C1+C2**：
 *                 页签标题与托盘 tooltip 共用同一纯函数输出，暂停态统一带 `⏸`）；
 *              ② `createPomodoroTitleSync`（写 DOM 的节流器：**复用既有 250ms tick 的秒级变化判定**，
 *                 不新增定时器 ⇒ 秒数未变不写；`idle` ⇒ 复位）。
 *
 * 期望实现落点：`packages/presentation/pomodoro/utils/pomodoro-title.ts`
 * 契约（见 `docs/qa/2026-10-29-T575-test-contracts.md` §2）：
 *   - `formatPomodoroTitle({ phase, status, remainingSeconds })` → `string | null`（`null` = 复位）
 *   - `createPomodoroTitleSync({ getSnapshot, writeTitle })` → `{ sync(), restore() }`
 *   - **复位值 = `NaoTodo`（PM 决策 D9/C3，非空串）**；idle / 结束 / 取消 / 卸载同值。
 *
 * ⚠️ 「离开番茄页仍继续更新」的覆盖方式：同步器**不接受任何路由/页面生命周期入参**（契约只有 2 个依赖），
 *    且用例 N15 在不挂载任何组件、不注入任何路由信息的前提下逐秒推进 —— 若实现把同步挂在页面组件上，
 *    该用例与真实场景都会失效。真实跨页可见性另列用户视觉勾选清单 ②。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 页签标题 · §六 NFR 性能 · §七 AC5 / AC6）
 * @see docs/reports/T574-arch-review.md（§二 载荷 / §五 第 7 条 文案单源）
 */

type Phase = 'idle' | 'focus' | 'break' | 'longBreak' | 'countUp'
type Status = 'running' | 'paused'

type Snapshot = { phase: Phase; status: Status; remainingSeconds: number }

interface TitleModule {
    formatPomodoroTitle: (input: Snapshot) => string | null
    createPomodoroTitleSync: (deps: {
        getSnapshot(): Snapshot
        writeTitle(title: string): void
    }) => { sync(): void; restore(): void }
}

const MODULE = 'packages/presentation/pomodoro/utils/pomodoro-title.ts'

/** 复位值（PM 决策 D9/C3：非空串；Electron `setToolTip('')` 等于移除 tooltip） */
const RESET = 'NaoTodo'

const load = (ac: string): Promise<TitleModule> =>
    loadImpl<TitleModule>(
        '../pomodoro-title',
        MODULE,
        ['formatPomodoroTitle', 'createPomodoroTitleSync'],
        ac
    )

describe('T575 ② AC5 文案格式（PRD §五 + D8 单源）', () => {
    it('AC5 专注运行中 ⇒ `MM:SS · 专注`', async () => {
        const { formatPomodoroTitle } = await load('AC5')
        expect(
            formatPomodoroTitle({ phase: 'focus', status: 'running', remainingSeconds: 1499 })
        ).toBe('24:59 · 专注')
    })

    it('AC5 短休息 ⇒ `04:30 · 休息`', async () => {
        const { formatPomodoroTitle } = await load('AC5')
        expect(
            formatPomodoroTitle({ phase: 'break', status: 'running', remainingSeconds: 270 })
        ).toBe('04:30 · 休息')
    })

    it('AC5 长休息 ⇒ `14:59 · 长休息`', async () => {
        const { formatPomodoroTitle } = await load('AC5')
        expect(
            formatPomodoroTitle({ phase: 'longBreak', status: 'running', remainingSeconds: 899 })
        ).toBe('14:59 · 长休息')
    })

    it('AC5 正计时 ⇒ `12:34 · 正计时`', async () => {
        const { formatPomodoroTitle } = await load('AC5')
        expect(
            formatPomodoroTitle({ phase: 'countUp', status: 'running', remainingSeconds: 754 })
        ).toBe('12:34 · 正计时')
    })

    it('AC5 暂停 ⇒ `⏸ 24:59 · 专注`（D8：暂停态统一带 ⏸，标题与 tooltip 同源）', async () => {
        const { formatPomodoroTitle } = await load('AC5')
        expect(
            formatPomodoroTitle({ phase: 'focus', status: 'paused', remainingSeconds: 1499 })
        ).toBe('⏸ 24:59 · 专注')
    })

    it('AC5 秒数补零 ⇒ `00:05 · 专注`', async () => {
        const { formatPomodoroTitle } = await load('AC5')
        expect(
            formatPomodoroTitle({ phase: 'focus', status: 'running', remainingSeconds: 5 })
        ).toBe('00:05 · 专注')
    })

    it('AC5 单源约束：tooltip 侧拿到的是**同一字符串**（不得另写模板 / 不得调序）', async () => {
        const { formatPomodoroTitle } = await load('AC5')
        const snapshot: Snapshot = { phase: 'break', status: 'running', remainingSeconds: 270 }
        // 同一入参两次调用必须逐字相同（纯函数 + 无隐藏状态），且顺序为「时间 · 阶段」
        expect(formatPomodoroTitle(snapshot)).toBe('04:30 · 休息')
        expect(formatPomodoroTitle(snapshot)).toBe(formatPomodoroTitle(snapshot))
    })

    it('AC6 idle ⇒ 返回 null（调用方据此复位，不得自行拼串）', async () => {
        const { formatPomodoroTitle } = await load('AC6')
        expect(
            formatPomodoroTitle({ phase: 'idle', status: 'paused', remainingSeconds: 1500 })
        ).toBeNull()
    })
})

/** 同步器夹具：可变快照 + 记录每次写入 */
const createSyncHarness = async () => {
    const mod = await load('AC5')
    let snapshot: Snapshot = { phase: 'focus', status: 'running', remainingSeconds: 1499 }
    const written: string[] = []
    const writeTitle = vi.fn((title: string) => {
        written.push(title)
    })

    const sync = mod.createPomodoroTitleSync({
        getSnapshot: () => snapshot,
        writeTitle
    })

    return {
        sync,
        writeTitle,
        written,
        setSnapshot(next: Partial<Snapshot>) {
            snapshot = { ...snapshot, ...next }
        }
    }
}

describe('T575 ② AC5 写入节流：每秒最多 1 次', () => {
    it('AC5 同一秒内 4 次 tick（250ms × 4）⇒ 只写 1 次 DOM', async () => {
        const h = await createSyncHarness()
        h.sync.sync()
        h.sync.sync()
        h.sync.sync()
        h.sync.sync()
        expect(h.writeTitle).toHaveBeenCalledTimes(1)
        expect(h.written).toEqual(['24:59 · 专注'])
    })

    it('AC5 秒数变化 ⇒ 再写 1 次（共 2 次），文案随之更新', async () => {
        const h = await createSyncHarness()
        h.sync.sync()
        h.setSnapshot({ remainingSeconds: 1498 })
        h.sync.sync()
        expect(h.writeTitle).toHaveBeenCalledTimes(2)
        expect(h.written).toEqual(['24:59 · 专注', '24:58 · 专注'])
    })

    it('AC5 暂停后数值冻结 ⇒ 多次 tick 不再写 DOM（且文案带 ⏸）', async () => {
        const h = await createSyncHarness()
        h.setSnapshot({ status: 'paused', remainingSeconds: 1499 })
        h.sync.sync()
        h.sync.sync()
        h.sync.sync()
        expect(h.writeTitle).toHaveBeenCalledTimes(1)
        expect(h.written).toEqual(['⏸ 24:59 · 专注'])
    })

    it('AC5 阶段切换（专注 → 休息）⇒ 1 次写入内反映新阶段', async () => {
        const h = await createSyncHarness()
        h.sync.sync()
        h.setSnapshot({ phase: 'break', remainingSeconds: 300 })
        h.sync.sync()
        expect(h.writeTitle).toHaveBeenCalledTimes(2)
        expect(h.written[1]).toBe('05:00 · 休息')
    })

    it('AC5 长休同样反映（专注 → 长休息）', async () => {
        const h = await createSyncHarness()
        h.setSnapshot({ phase: 'longBreak', remainingSeconds: 899 })
        h.sync.sync()
        expect(h.written).toEqual(['14:59 · 长休息'])
    })
})

describe('T575 ② AC6 负向闭环：结束 / 取消 / 回 idle ⇒ 复位为 NaoTodo', () => {
    it('AC6 回 idle ⇒ 标题复位为 `NaoTodo`（D9：非空串）', async () => {
        const h = await createSyncHarness()
        h.sync.sync()
        h.setSnapshot({ phase: 'idle', status: 'paused', remainingSeconds: 1500 })
        h.sync.sync()
        expect(h.written).toEqual(['24:59 · 专注', RESET])
    })

    it('AC6 回 idle 后继续 tick 不重复写（不残留旧倒计时、也不抖动）', async () => {
        const h = await createSyncHarness()
        h.sync.sync()
        h.setSnapshot({ phase: 'idle', status: 'paused', remainingSeconds: 1500 })
        h.sync.sync()
        h.sync.sync()
        h.sync.sync()
        expect(h.writeTitle).toHaveBeenCalledTimes(2)
        expect(h.written[1]).toBe(RESET)
    })

    it('AC6 restore() 显式复位（取消 / 卸载路径）且幂等', async () => {
        const h = await createSyncHarness()
        h.sync.sync()
        h.sync.restore()
        const afterFirst = h.writeTitle.mock.calls.length
        h.sync.restore()
        expect(h.written[0]).toBe('24:59 · 专注')
        expect(h.written[afterFirst - 1]).toBe(RESET)
        expect(h.writeTitle).toHaveBeenCalledTimes(afterFirst)
    })

    it('AC6 任何一次写入都不为空串（页面标题不得被清空）', async () => {
        const h = await createSyncHarness()
        h.sync.sync()
        h.sync.restore()
        h.setSnapshot({ phase: 'idle', status: 'paused' })
        h.sync.sync()
        expect(h.written.length).toBeGreaterThan(0)
        for (const title of h.written) expect(title.trim().length).toBeGreaterThan(0)
    })
})

describe('T575 ② AC6③ 离开番茄页但引擎仍在跑 ⇒ 继续更新', () => {
    it('AC6 无路由 / 无页面生命周期入参：连续 10 秒逐秒更新（不因「离开页面」停止）', async () => {
        const h = await createSyncHarness()
        // 10 秒 × 每秒 4 次 tick（模拟引擎 250ms tick，未变秒不写）
        let remaining = 1500
        for (let second = 0; second < 10; second += 1) {
            remaining -= 1
            h.setSnapshot({ remainingSeconds: remaining })
            for (let tick = 0; tick < 4; tick += 1) h.sync.sync()
        }
        expect(h.writeTitle).toHaveBeenCalledTimes(10)
        expect(h.written[0]).toBe('24:59 · 专注')
        expect(h.written[9]).toBe('24:50 · 专注')
    })
})