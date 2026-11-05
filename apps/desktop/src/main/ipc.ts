/**
 * 主进程 IPC 面（AC2 / AC13 / 安全语义）
 *
 * @description 渲染层只能经 **4 个窄通道**与主进程交互，**不接受任意路径/任意命令**，
 *              不传 token、不传文件路径（评审 §六「凭据暴露面不变」）：
 *              - `getShellStatus`：托盘 / 自启状态（设置页数据源）；
 *              - `setAutostart(bool)`：开关开机自启（只接受布尔值）；
 *              - `showMainWindow`：显示并聚焦主窗口（通知点击 / 设置页）；
 *              - `quit`：真退出（托盘不可见时的唯一退出路径）。
 *              每个 handler **先校验发送方来源**（`senderFrame.url` 受信），不受信或来源不可判定
 *              一律拒绝且**不执行动作**（默认拒绝）。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC2 / AC13 / AC9②）
 * @see docs/reports/T543-arch-review.md（§二 2.1 ipc.ts / §六 安全语义）
 */
import { DEFAULT_TRAY_TOOLTIP } from './tray'

/** 通道名（渲染层经 preload 的窄封装调用，不直接暴露 ipcRenderer） */
export const DESKTOP_IPC_CHANNELS = {
    getShellStatus: 'getShellStatus',
    setAutostart: 'setAutostart',
    showMainWindow: 'showMainWindow',
    quit: 'quit'
} as const

/** 主进程单向推送通道（渲染层 → 主进程）
 * @description **独立常量**：`on` 无回程通道、无拒绝面，语义与 4 个 `handle` 通道不同，
 *              ⛔ 不得并入 `DESKTOP_IPC_CHANNELS`（既有 `ipc.test.ts` 断言“4 个 invoke 通道”）。
 */
export const DESKTOP_ONEWAY_CHANNELS = {
    setTrayTooltip: 'setTrayTooltip'
} as const

/** 主进程向渲染层单向推送（非 `handle` 通道，不属可调用面）：系统从休眠恢复 */
export const DESKTOP_POWER_EVENT_CHANNEL = 'nao:power-resume'

/**
 * 主进程向渲染层单向推送：主窗口可见性（T654 / R-10 / AC5 桌面分支）
 * @description 桌面窗口隐藏到托盘时，`backgroundThrottling` 为 false 使 `document.visibilityState`
 *              **恒为 `visible`** ⇒ 不能用它判断「窗口是否在托盘里」；唯一信号 = 主进程 `show`/`hide`。
 * @see docs/prds/2026-11-05-sync-perception-polling.md（R-10 / AC5）
 */
export const DESKTOP_WINDOW_VISIBILITY_CHANNEL = 'nao:window-visibility'

/** IPC 事件最小面（Electron `IpcMainInvokeEvent` 的子集） */
export interface IpcEventLike {
    senderFrame?: { url?: string } | null
}

export type IpcListener = (event: IpcEventLike, ...args: unknown[]) => unknown

export interface RegisterDesktopIpcDeps {
    ipcMain: { handle(channel: string, listener: IpcListener): void }
    /** 发送方来源是否受信（桌面渲染层：打包后的 `file://` 或 dev server） */
    isTrustedUrl(url: string): boolean
    actions: {
        getShellStatus(): unknown
        setAutostart(enabled: boolean): unknown
        showMainWindow(): void
        quit(): void
    }
}

/** 来源校验：拿不到 URL ⇒ 视为不受信（默认拒绝） */
const assertTrusted = (
    event: IpcEventLike,
    deps: Pick<RegisterDesktopIpcDeps, 'isTrustedUrl'>
): void => {
    const url = event?.senderFrame?.url
    if (!url || !deps.isTrustedUrl(url)) throw new Error('[desktop] 拒绝不受信的 IPC 调用')
}

/**
 * 注册桌面端 IPC 处理器
 * @param deps `ipcMain` / 来源校验 / 动作实现
 */
export const registerDesktopIpcHandlers = (deps: RegisterDesktopIpcDeps): void => {
    deps.ipcMain.handle(DESKTOP_IPC_CHANNELS.getShellStatus, (event) => {
        assertTrusted(event, deps)
        return deps.actions.getShellStatus()
    })

    deps.ipcMain.handle(DESKTOP_IPC_CHANNELS.setAutostart, (event, enabled) => {
        assertTrusted(event, deps)
        if (typeof enabled !== 'boolean') throw new Error('[desktop] setAutostart 只接受布尔值')
        return deps.actions.setAutostart(enabled)
    })

    deps.ipcMain.handle(DESKTOP_IPC_CHANNELS.showMainWindow, (event) => {
        assertTrusted(event, deps)
        deps.actions.showMainWindow()
    })

    deps.ipcMain.handle(DESKTOP_IPC_CHANNELS.quit, (event) => {
        assertTrusted(event, deps)
        deps.actions.quit()
    })
}

/** tooltip 载荷长度上限（ADR §决策 1 / T574 §二：1..64 字符） */
const TRAY_TOOLTIP_MAX_LENGTH = 64
export interface RegisterDesktopTrayTooltipDeps {
    ipcMain: { on(channel: string, listener: IpcListener): void }
    isTrustedUrl(url: string): boolean
    /** 写入托盘 tooltip（托盘侧自行降级为 no-op） */
    setTrayTooltip(text: string): void
}

/**
 * 注册托盘 tooltip 单向通道（T576 #2 · AC7 / AC8）
 * @description 渲染层经 `ipcRenderer.send` 发来**已拼好的单个字符串**（1..64 字符）；
 *              主进程零拼装、零 i18n。不受信来源 / 来源不可判定 ⇒ 静默忽略；
 *              非字符串 / 空串 / 超长 ⇒ 回基线；整体 try/catch（单向通道永不抛）。
 */
export const registerDesktopTrayTooltipHandler = (deps: RegisterDesktopTrayTooltipDeps): void => {
    deps.ipcMain.on(DESKTOP_ONEWAY_CHANNELS.setTrayTooltip, (event, text) => {
        try {
            const url = event?.senderFrame?.url
            if (!url || !deps.isTrustedUrl(url)) return
            const valid =
                typeof text === 'string' &&
                text.length >= 1 &&
                text.length <= TRAY_TOOLTIP_MAX_LENGTH
            deps.setTrayTooltip(valid ? (text as string) : DEFAULT_TRAY_TOOLTIP)
        } catch {
            // 单向通道无回程面：任何异常只允许落在主进程，且不得影响其它能力
        }
    })
}

/** 窗口可见性推播所需的最小面（Electron `BrowserWindow` 满足） */
export interface WindowVisibilityLike {
    isVisible(): boolean
    isDestroyed(): boolean
    on(event: 'show' | 'hide', listener: () => void): unknown
    webContents: {
        send(channel: string, ...args: unknown[]): void
        on(event: 'did-finish-load', listener: () => void): unknown
    }
}

/**
 * 把主窗口可见性推给渲染层（T654 / R-10 / AC5 桌面分支）
 * @description 三个推播点：`show` / `hide` / `did-finish-load`。
 *              最后一个用于**首帧初值**：自启静默到托盘时窗口本就不可见，渲染层必须一开始就知道；
 *              否则会以「可见」为初值多拉一次（不影响正确性，但白花请求）。
 *              单向通道：渲染层不发请求、不回传任何数据。
 */
export const bindWindowVisibility = (window: WindowVisibilityLike): void => {
    const publish = (): void => {
        try {
            if (window.isDestroyed()) return
            window.webContents.send(DESKTOP_WINDOW_VISIBILITY_CHANNEL, window.isVisible())
        } catch {
            // 窗口/渲染层已销毁：静默降级（不得影响生命周期）
        }
    }
    window.on('show', publish)
    window.on('hide', publish)
    window.webContents.on('did-finish-load', publish)
}