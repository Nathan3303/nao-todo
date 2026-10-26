import { describe, expect, it, vi } from 'vite-plus/test'
import { loadImpl } from './impl-seam'

/**
 * T544 · 桌面主进程生命周期状态机（AC1 / AC2 / AC5 / AC9① / AC14 / AC4 静默启动 / R14）
 *
 * @description 关窗 = 隐藏且不销毁、真退出唯一出口、第二实例不打扰自启、常驻态不因
 *              `window-all-closed` 退出、系统注销/关机必须放行。全部用**注入式假窗口**断言，
 *              不拉起真实 Electron。
 *
 * 期望实现落点（`docs/reports/T543-arch-review.md` §五 5.1 的可测化）：
 * `apps/desktop/src/main/lifecycle.ts` —— 主进程状态机抽成纯逻辑，`index.ts` 只做接线。
 * 契约（RD 可改内部实现，但需保留下列可测入口）：
 * ```text
 * createAppLifecycle({ platform, trayStatus, app, getWindow, settings, notifyTrayHint })
 *   → isQuitting()
 *     handleWindowClose(event, window) → 'hide' | 'allow'
 *     handleSecondInstance(cmdLine)
 *     handleWindowAllClosed()          → 'ignore' | 'quit'（quit 时自行调用 app.quit）
 *     handleQuitSignal(signal)         // before-quit | query-session-end | session-end
 *     handleActivate()                 → 'shown' | 'create'
 *     requestQuit()
 * shouldShowWindowOnReady({ argv, trayStatus }) → boolean
 * ```
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC1/AC2/AC4/AC5/AC9/AC14）
 * @see docs/reports/T543-arch-review.md（§四 托盘判定 / §五 5.1 状态机 / R14）
 */

type TrayStatus = 'available' | 'unconfirmed' | 'unsupported'
type QuitSignal = 'before-quit' | 'query-session-end' | 'session-end'

interface WindowLike {
    isDestroyed(): boolean
    isMinimized(): boolean
    isVisible(): boolean
    hide(): void
    show(): void
    restore(): void
    focus(): void
}

interface LifecycleDeps {
    platform: string
    trayStatus: TrayStatus
    app: { quit(): void }
    getWindow(): WindowLike | null
    settings: { isTrayHintShown(): boolean; markTrayHintShown(): void }
    notifyTrayHint(): void
}

interface AppLifecycle {
    isQuitting(): boolean
    handleWindowClose(event: { preventDefault(): void }, window: WindowLike): 'hide' | 'allow'
    handleSecondInstance(cmdLine: readonly string[]): void
    handleWindowAllClosed(): 'ignore' | 'quit'
    handleQuitSignal(signal: QuitSignal): void
    handleActivate(): 'shown' | 'create'
    requestQuit(): void
}

interface LifecycleModule {
    createAppLifecycle(deps: LifecycleDeps): AppLifecycle
    shouldShowWindowOnReady(options: { argv: readonly string[]; trayStatus: TrayStatus }): boolean
}

const MODULE = 'apps/desktop/src/main/lifecycle.ts'
const load = (ac: string): Promise<LifecycleModule> =>
    loadImpl<LifecycleModule>(
        '../lifecycle',
        MODULE,
        ['createAppLifecycle', 'shouldShowWindowOnReady'],
        ac
    )

/** 假窗口：只实现状态机用得到的最小面 */
const createFakeWindow = (initial: { minimized?: boolean; visible?: boolean } = {}) => {
    const calls = { hide: 0, show: 0, restore: 0, focus: 0 }
    let minimized = initial.minimized ?? false
    let visible = initial.visible ?? true
    const window: WindowLike = {
        isDestroyed: () => false,
        isMinimized: () => minimized,
        isVisible: () => visible,
        hide: () => {
            visible = false
            calls.hide += 1
        },
        show: () => {
            visible = true
            calls.show += 1
        },
        restore: () => {
            minimized = false
            calls.restore += 1
        },
        focus: () => {
            calls.focus += 1
        }
    }
    return { window, calls, state: () => ({ minimized, visible }) }
}

/** 假 close 事件：记录是否被拦截 */
const createCloseEvent = () => {
    const calls = { preventDefault: 0 }
    return {
        event: {
            preventDefault: () => {
                calls.preventDefault += 1
            }
        },
        calls
    }
}

const createHarness = async (options: {
    ac: string
    platform?: string
    trayStatus?: TrayStatus
    hintShown?: boolean
    window?: WindowLike | null
}) => {
    const mod = await load(options.ac)
    const quit = vi.fn()
    const notifyTrayHint = vi.fn()
    const markTrayHintShown = vi.fn()
    let hintShown = options.hintShown ?? false
    // ⚠️ 不能用 `options.window ?? ...`：`??` 会把**显式传入的 null**（首实例无窗口的合法状态）
    //    兜成假窗口，使「无窗口」用例与「窗口已隐藏」用例处在同一可观测状态（T547 夹具缺陷）。
    const currentWindow = 'window' in options ? (options.window ?? null) : createFakeWindow().window
    const lifecycle = mod.createAppLifecycle({
        platform: options.platform ?? 'linux',
        trayStatus: options.trayStatus ?? 'available',
        app: { quit },
        getWindow: () => currentWindow,
        settings: {
            isTrayHintShown: () => hintShown,
            markTrayHintShown: () => {
                hintShown = true
                markTrayHintShown()
            }
        },
        notifyTrayHint
    })
    return { mod, lifecycle, quit, notifyTrayHint, markTrayHintShown, window: currentWindow }
}

describe('生命周期 · 关窗语义（AC1 / AC9）', () => {
    it('托盘可用（available）⇒ 拦截关闭 + hide，窗口不销毁（AC1）', async () => {
        const { lifecycle, window } = await createHarness({ ac: 'AC1', trayStatus: 'available' })
        const fake = createFakeWindow()
        const { event, calls } = createCloseEvent()

        expect(lifecycle.handleWindowClose(event, fake.window)).toBe('hide')
        expect(calls.preventDefault).toBe(1)
        expect(fake.calls.hide).toBe(1)
        expect(fake.state().visible).toBe(false)
        // 未隐藏「传给状态机之外的窗口」——防止实现 hide 错对象
        expect(window).not.toBe(fake.window)
    })

    it('托盘可能不可见（unconfirmed，如 GNOME 无扩展）⇒ 仍然 hide 常驻（AC9②）', async () => {
        const { lifecycle } = await createHarness({ ac: 'AC9②', trayStatus: 'unconfirmed' })
        const fake = createFakeWindow()
        const { event, calls } = createCloseEvent()

        expect(lifecycle.handleWindowClose(event, fake.window)).toBe('hide')
        expect(calls.preventDefault).toBe(1)
        expect(fake.calls.hide).toBe(1)
    })

    it('托盘不可用（unsupported）⇒ 放行关闭（旧行为：关窗即退出）（AC9①）', async () => {
        const { lifecycle } = await createHarness({ ac: 'AC9①', trayStatus: 'unsupported' })
        const fake = createFakeWindow()
        const { event, calls } = createCloseEvent()

        expect(lifecycle.handleWindowClose(event, fake.window)).toBe('allow')
        expect(calls.preventDefault).toBe(0)
        expect(fake.calls.hide).toBe(0)
    })

    it('已置退出位（用户点「退出」）⇒ 放行关闭，不再拦（AC2）', async () => {
        const { lifecycle } = await createHarness({ ac: 'AC2' })
        const fake = createFakeWindow()
        lifecycle.requestQuit()
        const { event, calls } = createCloseEvent()

        expect(lifecycle.isQuitting()).toBe(true)
        expect(lifecycle.handleWindowClose(event, fake.window)).toBe('allow')
        expect(calls.preventDefault).toBe(0)
        expect(fake.calls.hide).toBe(0)
    })

    it('首次收进托盘 ⇒ 发一次提示；再次关闭不重复（AC14）', async () => {
        const { lifecycle, notifyTrayHint, markTrayHintShown } = await createHarness({
            ac: 'AC14',
            hintShown: false
        })
        const fake = createFakeWindow()

        lifecycle.handleWindowClose(createCloseEvent().event, fake.window)
        lifecycle.handleWindowClose(createCloseEvent().event, fake.window)

        expect(notifyTrayHint).toHaveBeenCalledTimes(1)
        expect(markTrayHintShown).toHaveBeenCalledTimes(1)
        expect(fake.calls.hide).toBe(2)
    })

    it('已提示过（userData 标记）⇒ 本进程不再提示（AC14 持久化）', async () => {
        const { lifecycle, notifyTrayHint, markTrayHintShown } = await createHarness({
            ac: 'AC14',
            hintShown: true
        })
        const fake = createFakeWindow()

        lifecycle.handleWindowClose(createCloseEvent().event, fake.window)

        expect(notifyTrayHint).not.toHaveBeenCalled()
        expect(markTrayHintShown).not.toHaveBeenCalled()
    })
})

describe('生命周期 · 真退出与系统退出（AC2 / R14）', () => {
    it('requestQuit ⇒ 置退出位并请求退出（托盘/设置页「退出」唯一出口，AC2）', async () => {
        const { lifecycle, quit } = await createHarness({ ac: 'AC2' })

        lifecycle.requestQuit()

        expect(lifecycle.isQuitting()).toBe(true)
        expect(quit).toHaveBeenCalledTimes(1)
    })

    it.each<QuitSignal>(['before-quit', 'query-session-end', 'session-end'])(
        '%s ⇒ 置退出位，放行窗口关闭（R14：不拦系统注销/关机）',
        async (signal) => {
            const { lifecycle } = await createHarness({ ac: 'R14' })
            const fake = createFakeWindow()

            lifecycle.handleQuitSignal(signal)

            expect(lifecycle.isQuitting()).toBe(true)
            expect(lifecycle.handleWindowClose(createCloseEvent().event, fake.window)).toBe('allow')
            expect(fake.calls.hide).toBe(0)
        }
    )
})

describe('生命周期 · window-all-closed（AC1 / AC9①）', () => {
    it('常驻态（available）⇒ 不退出（AC1）', async () => {
        const { lifecycle, quit } = await createHarness({ ac: 'AC1', trayStatus: 'available' })

        expect(lifecycle.handleWindowAllClosed()).toBe('ignore')
        expect(quit).not.toHaveBeenCalled()
    })

    it('可能不可见（unconfirmed）⇒ 仍不退出（AC9②）', async () => {
        const { lifecycle, quit } = await createHarness({ ac: 'AC9②', trayStatus: 'unconfirmed' })

        expect(lifecycle.handleWindowAllClosed()).toBe('ignore')
        expect(quit).not.toHaveBeenCalled()
    })

    it('托盘不可用 + 非 darwin ⇒ 退出（旧行为，AC9①）', async () => {
        const { lifecycle, quit } = await createHarness({
            ac: 'AC9①',
            trayStatus: 'unsupported',
            platform: 'linux'
        })

        expect(lifecycle.handleWindowAllClosed()).toBe('quit')
        expect(quit).toHaveBeenCalledTimes(1)
    })

    it('托盘不可用 + darwin ⇒ 不退出（维持既有 macOS 行为）（AC12 零回归）', async () => {
        const { lifecycle, quit } = await createHarness({
            ac: 'AC12',
            trayStatus: 'unsupported',
            platform: 'darwin'
        })

        expect(lifecycle.handleWindowAllClosed()).toBe('ignore')
        expect(quit).not.toHaveBeenCalled()
    })
})

describe('生命周期 · 第二实例 / 激活（AC5 / AC1）', () => {
    it('第二实例（手动启动）⇒ show + restore + focus（AC5）', async () => {
        const fake = createFakeWindow({ minimized: true, visible: false })
        const { lifecycle } = await createHarness({ ac: 'AC5', window: fake.window })

        lifecycle.handleSecondInstance(['/opt/nao-todo'])

        expect(fake.calls.show).toBe(1)
        expect(fake.calls.restore).toBe(1)
        expect(fake.calls.focus).toBe(1)
    })

    it('第二实例带 --autostart ⇒ 静默忽略，不打扰用户（AC5 / 自启去重）', async () => {
        const fake = createFakeWindow({ visible: false })
        const { lifecycle } = await createHarness({ ac: 'AC5', window: fake.window })

        lifecycle.handleSecondInstance(['/opt/nao-todo', '--autostart'])

        expect(fake.calls.show).toBe(0)
        expect(fake.calls.restore).toBe(0)
        expect(fake.calls.focus).toBe(0)
    })

    it('第二实例但首实例无窗口 ⇒ 不抛错（no-op）（AC5）', async () => {
        const { lifecycle } = await createHarness({ ac: 'AC5', window: null })

        expect(() => lifecycle.handleSecondInstance(['/opt/nao-todo'])).not.toThrow()
    })

    it('activate（mac Dock 点击）且窗口已隐藏 ⇒ 恢复显示（AC1）', async () => {
        const fake = createFakeWindow({ visible: false })
        const { lifecycle } = await createHarness({ ac: 'AC1', window: fake.window })

        expect(lifecycle.handleActivate()).toBe('shown')
        expect(fake.calls.show).toBe(1)
        expect(fake.calls.focus).toBe(1)
    })

    it('activate 且窗口不存在 ⇒ 交由调用方建窗（AC1）', async () => {
        const { lifecycle } = await createHarness({ ac: 'AC1', window: null })

        expect(lifecycle.handleActivate()).toBe('create')
    })
})

describe('自启静默启动（AC4 / P4 降级）', () => {
    it('--autostart 且托盘可用 ⇒ 不显示主窗口（静默到托盘）', async () => {
        const { mod } = await createHarness({ ac: 'AC4' })

        expect(
            mod.shouldShowWindowOnReady({
                argv: ['/opt/nao-todo', '--autostart'],
                trayStatus: 'available'
            })
        ).toBe(false)
    })

    it('--autostart 但托盘可能不可见（unconfirmed）⇒ 显示窗口，避免完全不可见（P4/RV11）', async () => {
        const { mod } = await createHarness({ ac: 'AC4' })

        expect(
            mod.shouldShowWindowOnReady({
                argv: ['/opt/nao-todo', '--autostart'],
                trayStatus: 'unconfirmed'
            })
        ).toBe(true)
    })

    it('--autostart 但托盘不可用（unsupported）⇒ 显示窗口，避免应用完全不可见（P4）', async () => {
        const { mod } = await createHarness({ ac: 'AC4' })

        expect(
            mod.shouldShowWindowOnReady({
                argv: ['/opt/nao-todo', '--autostart'],
                trayStatus: 'unsupported'
            })
        ).toBe(true)
    })

    it('非自启启动 ⇒ 正常显示窗口（AC1 不变）', async () => {
        const { mod } = await createHarness({ ac: 'AC1' })

        expect(
            mod.shouldShowWindowOnReady({ argv: ['/opt/nao-todo'], trayStatus: 'available' })
        ).toBe(true)
    })
})