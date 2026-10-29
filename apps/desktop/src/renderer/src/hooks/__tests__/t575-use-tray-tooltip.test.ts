// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

/**
 * T575 ② 桌面托盘 tooltip —— 渲染层接线（AC7 / AC8 渲染层半边）
 *
 * @description 口径（`T574` arch 评审 + PM 决策 D8/D9/D10）：
 *              - **文案单源**：tooltip 载荷 = `formatPomodoroTitle` 的同一字符串（`24:59 · 专注`，
 *                暂停带 `⏸`），渲染层**不重新拼模板、不调序**；
 *              - **节流 = 按值去重 + 秒粒度**（不引入时间闸）：同一秒内 4 次 tick 只发 1 次；
 *              - **AC7 计数窗口（D10）**：稳态 5s 窗口 **≤5 次**；窗口**含阶段切换**允许 **+1 次**
 *                （本文件里 idle→专注 的首发、专注→休息 的换文案各算 1 次 +1）；
 *              - **复位（D9）**：idle / 结束 / 取消 / 卸载 ⇒ 发 `NaoTodo`（**非空串**；
 *                Electron `setToolTip('')` 等于移除 tooltip）；
 *              - **降级（AC8）**：无 `desktopAPI` / 旧桥缺 `setTrayTooltip` / 发送抛错 ⇒
 *                全静默，**不抛且不 `console.error`**。
 *
 * 期望实现落点：`apps/desktop/src/renderer/src/hooks/use-tray-tooltip.ts`（导出 `useTrayTooltip`）
 * 依赖假设：hook 自取全局番茄计时 store（`usePomodoroTimerStore`）⇒ 本用例驱动**真实 store**，
 *          用假定时器逐 tick 推进（= 真实 250ms 驱动节奏）。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 页签标题 · §七 AC7 / AC8 · §九 D8/D9/D10）
 * @see docs/reports/T574-arch-review.md（§二 通道规格 · §三 节流与背压 · §四 失败降级 · §五.6 hook 落点）
 */

const hoisted = vi.hoisted(() => ({ bridge: { current: null as unknown } }))

vi.mock('../../desktop-bridge', () => ({ getDesktopBridge: () => hoisted.bridge.current }))

import { usePomodoroSessionStore, usePomodoroTimerStore } from '@nao-todo/presentation/pomodoro'
import { loadImpl } from './impl-seam'

const MODULE = 'apps/desktop/src/renderer/src/hooks/use-tray-tooltip.ts'

interface HookModule {
    useTrayTooltip: () => unknown
}

/** 复位值（PM 决策 D9/C3） */
const RESET = 'NaoTodo'

/** 构造假桌面桥（`mode` 覆盖 AC8 的三种降级形态） */
const makeBridge = (mode: 'ok' | 'missing-method' | 'throws' = 'ok') => {
    const sent: string[] = []
    const bridge: Record<string, unknown> = {
        isDesktop: true,
        platform: 'linux',
        versions: { electron: '31', chrome: '120', node: '20' },
        getShellStatus: async () => ({ tray: 'available', autostart: 'enabled' }),
        setAutostart: async () => ({ autostart: 'enabled' }),
        showMainWindow: async () => undefined,
        quit: async () => undefined,
        onPowerResume: () => () => undefined
    }
    if (mode !== 'missing-method') {
        bridge.setTrayTooltip = (text: string) => {
            if (mode === 'throws') throw new Error('ipc unavailable')
            sent.push(text)
        }
    }
    return { bridge, sent }
}

let timer: ReturnType<typeof usePomodoroTimerStore>
let session: ReturnType<typeof usePomodoroSessionStore>
let wrappers: { unmount(): void }[] = []
let errorSpy: ReturnType<typeof vi.spyOn>

/** 挂载一个只调用 hook 的最小组件（hook 需要组件上下文 / 生命周期） */
const mountHook = async (bridge: unknown) => {
    hoisted.bridge.current = bridge
    const { useTrayTooltip } = await loadImpl<HookModule>(
        '../use-tray-tooltip',
        MODULE,
        ['useTrayTooltip'],
        'AC7'
    )
    const wrapper = mount({
        setup() {
            useTrayTooltip()
            return {}
        },
        template: '<div />'
    })
    wrappers.push(wrapper)
    await nextTick()
    return wrapper
}

/** 逐 250ms 推进（模拟引擎驱动），每次 flush 一次 watcher */
const advanceTicks = async (steps: number) => {
    for (let i = 0; i < steps; i += 1) {
        vi.advanceTimersByTime(250)
        await nextTick()
    }
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0, 0))
    localStorage.clear()
    wrappers = []
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    setActivePinia(createPinia())
    session = usePomodoroSessionStore()
    session.setFocusDuration(25 * 60)
    session.setBreakDuration(5 * 60)
    session.setLongBreakDuration(15 * 60)
    session.setSessionsUntilLongBreak(4)
    session.setAutoRest(true)
    session.setAutoStartNextFocusSession(false)
    timer = usePomodoroTimerStore()
    timer.updateConfig()
})

afterEach(() => {
    for (const wrapper of wrappers) wrapper.unmount()
    wrappers = []
    timer.destroy()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe('T575 ② AC7 托盘 tooltip：单源文案 + 按值去重', () => {
    it('AC7 idle 初始态 ⇒ 发复位值 `NaoTodo`（非空串）', async () => {
        const { bridge, sent } = makeBridge()
        await mountHook(bridge)
        expect(sent).toEqual([RESET])
    })

    it('AC7 稳态 5s 窗口（不含阶段切换）⇒ 推送 ≤5 次，文案为「时间 · 阶段」', async () => {
        const { bridge, sent } = makeBridge()
        await mountHook(bridge)

        timer.start() // idle→专注 = D10 允许的 +1（窗口外）
        await nextTick()
        expect(sent[sent.length - 1]).toBe('25:00 · 专注')

        const baseline = sent.length
        await advanceTicks(20) // 5 秒
        const window = sent.slice(baseline)

        expect(window.length).toBeLessThanOrEqual(5)
        expect(window.length).toBeGreaterThanOrEqual(4)
        for (const text of window) expect(text).toMatch(/^\d{2}:\d{2} · 专注$/)
        // 按值去重：窗口内不得出现相邻重复值
        for (let i = 1; i < window.length; i += 1) expect(window[i]).not.toBe(window[i - 1])
    })

    it('AC7 同一秒内 3 次 tick + 跨秒 1 次 ⇒ 只多推 1 次（4 tick → 1 send）', async () => {
        const { bridge, sent } = makeBridge()
        await mountHook(bridge)
        timer.start()
        await nextTick()
        const baseline = sent.length

        await advanceTicks(3) // t=750ms，秒数未变
        expect(sent.length).toBe(baseline)

        vi.advanceTimersByTime(250) // t=1000ms ⇒ 24:59
        await nextTick()
        expect(sent.length).toBe(baseline + 1)
        expect(sent[sent.length - 1]).toBe('24:59 · 专注')
    })

    it('AC7 暂停 ⇒ 文案带 ⏸ 且之后数值冻结不再推送', async () => {
        const { bridge, sent } = makeBridge()
        await mountHook(bridge)
        timer.start()
        await advanceTicks(4)

        timer.pause()
        await nextTick()
        expect(sent[sent.length - 1]).toBe('⏸ 24:59 · 专注')

        const baseline = sent.length
        await advanceTicks(8) // 2 秒
        expect(sent.length).toBe(baseline)
    })

    it('AC7 窗口跨阶段切换（专注→休息）⇒ ≤6 次（稳态 5 + D10 的 +1），且换到休息文案', async () => {
        session.setFocusDuration(300)
        session.setBreakDuration(300)
        timer.updateConfig()

        const { bridge, sent } = makeBridge()
        await mountHook(bridge)
        timer.start()
        await nextTick()

        vi.advanceTimersByTime(295_000) // 快速推进到剩余 5s（窗口外）
        await nextTick()
        const baseline = sent.length

        await advanceTicks(20) // 含阶段完成的那 5 秒窗口
        const window = sent.slice(baseline)

        expect(window.length).toBeLessThanOrEqual(6)
        expect(sent[sent.length - 1]).toContain('休息')
    })
})

describe('T575 ② AC6 负向闭环：结束 / 卸载 ⇒ 复位', () => {
    it('AC6 结束专注（end）⇒ 发 `NaoTodo`', async () => {
        const { bridge, sent } = makeBridge()
        await mountHook(bridge)
        timer.start()
        await advanceTicks(4)
        expect(sent[sent.length - 1]).toMatch(/ · 专注$/)

        timer.end()
        await nextTick()
        expect(sent[sent.length - 1]).toBe(RESET)
    })

    it('AC6 卸载 ⇒ 发 `NaoTodo`（不残留旧倒计时）', async () => {
        const { bridge, sent } = makeBridge()
        const wrapper = await mountHook(bridge)
        timer.start()
        await advanceTicks(4)

        wrapper.unmount()
        await nextTick()
        expect(sent[sent.length - 1]).toBe(RESET)
    })
})

describe('T575 ② AC8 降级：全静默（不抛 + 无 console.error）', () => {
    it('AC8 无 desktopAPI（Web / 无 preload）⇒ 不抛、无错误日志', async () => {
        await mountHook(null)
        timer.start()
        await expect(advanceTicks(8)).resolves.toBeUndefined()
        expect(errorSpy).not.toHaveBeenCalled()
    })

    it('AC8 旧桥缺 `setTrayTooltip` 方法 ⇒ 不抛、无错误日志', async () => {
        const { bridge } = makeBridge('missing-method')
        await mountHook(bridge)
        timer.start()
        await expect(advanceTicks(8)).resolves.toBeUndefined()
        expect(errorSpy).not.toHaveBeenCalled()
    })

    it('AC8 发送抛错（通道未注册 / 窗口销毁中）⇒ 被吞掉、无错误日志', async () => {
        const { bridge } = makeBridge('throws')
        await mountHook(bridge)
        timer.start()
        await expect(advanceTicks(8)).resolves.toBeUndefined()
        expect(errorSpy).not.toHaveBeenCalled()
    })
})