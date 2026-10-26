/**
 * 桌面端主进程生命周期状态机（AC1 / AC2 / AC4 / AC5 / AC9 / AC14 / R14）
 *
 * @description 把「关窗 = 隐藏不销毁 / 真退出唯一出口 / 第二实例去重 / 常驻不因无窗口退出 /
 *              系统注销关机必须放行」抽成**纯逻辑**（不 import electron），`index.ts` 只做事件接线。
 *              口径来源（`docs/reports/T543-arch-review.md` §四 / §五 5.1）：
 *              - 托盘 `available` / `unconfirmed` ⇒ 关窗 `preventDefault` + `hide()`；
 *              - 托盘 `unsupported` ⇒ 放行（旧行为：关窗即退出），设置区显示「不支持」；
 *              - `window-all-closed`：常驻态忽略；托盘不可用且非 macOS 才退出（保 macOS 既有语义）；
 *              - 首次隐藏发**一次性**提示（标记落 `userData`，见 `app-settings.ts`），再关闭不重复；
 *              - 系统退出信号（`before-quit` / `query-session-end` / `session-end`）先置退出位，
 *                否则隐藏态的 `close` 拦截会把注销/关机拖住（R14）。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC1/AC2/AC4/AC5/AC9/AC14）
 * @see docs/reports/T543-arch-review.md（§五 5.1 状态机 / §五 5.4 自启持久化 / R14）
 */

/** 托盘三态（判定口径唯一，见评审 §四） */
export type TrayStatus = 'available' | 'unconfirmed' | 'unsupported'

/** 系统退出信号（Windows 注销/关机 + 通用 before-quit） */
export type QuitSignal = 'before-quit' | 'query-session-end' | 'session-end'

/** 状态机用得到的窗口最小面（Electron `BrowserWindow` 满足） */
export interface LifecycleWindowLike {
    isDestroyed(): boolean
    isMinimized(): boolean
    isVisible(): boolean
    hide(): void
    show(): void
    restore(): void
    focus(): void
}

export interface AppLifecycleDeps {
    /** `process.platform`（`darwin` 保持 macOS 既有「无窗口不退出」语义） */
    platform: string
    /** 托盘判定结果（`createTray()` 返回值，见 `tray.ts`） */
    trayStatus: TrayStatus
    /** 仅用 `quit()`（真退出） */
    app: { quit(): void }
    /** 当前主窗口（可能尚未创建 / 已销毁） */
    getWindow(): LifecycleWindowLike | null
    /** 一次性「仍在后台运行」提示的持久化标记（`app-settings.ts`） */
    settings: { isTrayHintShown(): boolean; markTrayHintShown(): void }
    /** 发系统通知（首次收进托盘时一次） */
    notifyTrayHint(): void
}

export interface AppLifecycle {
    isQuitting(): boolean
    handleWindowClose(
        event: { preventDefault(): void },
        window: LifecycleWindowLike
    ): 'hide' | 'allow'
    handleSecondInstance(cmdLine: readonly string[]): void
    handleWindowAllClosed(): 'ignore' | 'quit'
    handleQuitSignal(signal: QuitSignal): void
    handleActivate(): 'shown' | 'create'
    requestQuit(): void
}

/** 自启启动参数（自启时静默到托盘；见 AC4 / D4） */
export const AUTOSTART_ARG = '--autostart'

/**
 * 创建主进程生命周期状态机
 * @param deps 注入依赖（平台 / 托盘状态 / 窗口获取 / 提示标记）
 */
export const createAppLifecycle = (deps: AppLifecycleDeps): AppLifecycle => {
    let quitting = false
    /** 本进程内是否已提示过（持久化标记之外的第二道保险，避免同进程重复写盘） */
    let hintShown = false

    /** 显示并前置窗口（隐藏窗口 `focus()` 无效 ⇒ 必须先 `show()`），返回是否找到窗口 */
    const present = (window: LifecycleWindowLike | null): boolean => {
        if (!window || window.isDestroyed()) return false
        if (window.isMinimized()) window.restore()
        if (!window.isVisible()) window.show()
        window.focus()
        return true
    }

    return {
        isQuitting: () => quitting,

        handleWindowClose: (event, window) => {
            // 真退出 / 托盘不可用 ⇒ 旧行为（放行，窗口销毁）
            if (quitting || deps.trayStatus === 'unsupported') return 'allow'
            event.preventDefault()
            window.hide()
            if (!hintShown && !deps.settings.isTrayHintShown()) {
                hintShown = true
                deps.settings.markTrayHintShown()
                deps.notifyTrayHint()
            }
            return 'hide'
        },

        handleSecondInstance: (cmdLine) => {
            // 自启 + 手动启动并发：自启那次不打扰用户（AC5）
            if (cmdLine.includes(AUTOSTART_ARG)) return
            present(deps.getWindow())
        },

        handleWindowAllClosed: () => {
            if (deps.trayStatus !== 'unsupported') return 'ignore'
            if (deps.platform === 'darwin') return 'ignore'
            deps.app.quit()
            return 'quit'
        },

        handleQuitSignal: () => {
            // 系统注销/关机：先置退出位，后续 close 才会放行（R14）
            quitting = true
        },

        handleActivate: () => {
            if (!present(deps.getWindow())) return 'create'
            return 'shown'
        },

        requestQuit: () => {
            quitting = true
            deps.app.quit()
        }
    }
}

/**
 * 窗口首次 `ready-to-show` 是否显示主窗口
 * @description 自启（`--autostart`）+ 托盘可用 ⇒ 静默到托盘；托盘**不可用或可能不可见**时
 *              必须显示窗口，否则应用完全不可见（P4 / RV11）。
 * @param options `argv` = 启动参数；`trayStatus` = 托盘判定结果
 */
export const shouldShowWindowOnReady = (options: {
    argv: readonly string[]
    trayStatus: TrayStatus
}): boolean => {
    if (!options.argv.includes(AUTOSTART_ARG)) return true
    return options.trayStatus !== 'available'
}