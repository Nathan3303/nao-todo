import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopUpdateInstallOptions, DesktopUpdateStatus } from '@nao-todo/shared'
import {
    DESKTOP_IPC_CHANNELS,
    DESKTOP_ONEWAY_CHANNELS,
    DESKTOP_POWER_EVENT_CHANNEL,
    DESKTOP_UPDATE_CHANNELS,
    DESKTOP_UPDATE_STATUS_CHANNEL,
    DESKTOP_WINDOW_VISIBILITY_CHANNEL
} from '../main/ipc'

/**
 * 最小桌面能力桥（AC13 / 安全语义）
 *
 * @description 渲染层**只能**经这 4 个窄通道 + 1 个订阅与主进程交互：不暴露 `ipcRenderer`
 *              （避免任意通道/任意参数），不传 token、不传文件路径。
 *              通道名单一真源 = `main/ipc.ts` 的 `DESKTOP_IPC_CHANNELS`。
 * @see apps/desktop/src/main/ipc.ts
 * @see docs/reports/T543-arch-review.md（§二 2.1 ipc.ts / §六 凭据暴露面不变）
 */
/**
 * 最近一次主窗口可见性（T654 / R-10）
 * @description preload 在**页面脚本之前**执行 ⇒ 在最早期就开始缓存主进程推播的首帧可见性；
 *              订阅时先回放缓存值，避免「消息先到、渲染层后订阅」的初值空洞
 *              （自启静默到托盘时窗口本就隐藏，若漏首帧则渲染层会以「可见」为初值多拉）。
 */
let lastWindowVisible: boolean | null = null
ipcRenderer.on(DESKTOP_WINDOW_VISIBILITY_CHANNEL, (_event, visible: unknown) => {
    lastWindowVisible = visible === true
})

/**
 * 最近一次更新状态（T736 / AC1–AC11）
 * @description 同 `lastWindowVisible` 的理由：preload 在页面脚本之前执行，先在最早时刻缓存
 *              主进程推播的状态；渲染层订阅时先回放，避开「主进程先推、渲染层后订」的初值空洞。
 */
let lastUpdateStatus: DesktopUpdateStatus | null = null
ipcRenderer.on(DESKTOP_UPDATE_STATUS_CHANNEL, (_event, status: unknown) => {
    if (status && typeof status === 'object') lastUpdateStatus = status as DesktopUpdateStatus
})

contextBridge.exposeInMainWorld('desktopAPI', {
    isDesktop: true,
    platform: process.platform,
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
    },
    getShellStatus: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.getShellStatus),
    setAutostart: (enabled: boolean) =>
        ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.setAutostart, Boolean(enabled)),
    showMainWindow: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.showMainWindow),
    quit: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.quit),
    // 单向写（无返回值 / 无拒绝面）：托盘 tooltip 走 `send`，handler 缺失时静默降级
    setTrayTooltip: (text: string) =>
        ipcRenderer.send(DESKTOP_ONEWAY_CHANNELS.setTrayTooltip, text),
    onPowerResume: (callback: () => void) => {
        const listener = () => callback()
        ipcRenderer.on(DESKTOP_POWER_EVENT_CHANNEL, listener)
        return () => ipcRenderer.removeListener(DESKTOP_POWER_EVENT_CHANNEL, listener)
    },
    // T654 / R-10：主窗口可见性（托盘隐藏 = false，唤回 = true）—— 桌面端轮询门控唯一信号
    onWindowVisibility: (callback: (visible: boolean) => void) => {
        const listener = (_event: unknown, visible: boolean) => callback(visible === true)
        ipcRenderer.on(DESKTOP_WINDOW_VISIBILITY_CHANNEL, listener)
        // 回放已知初值（若已收到过）——订阅方无需再等下一次 show/hide
        if (lastWindowVisible !== null) callback(lastWindowVisible)
        return () => ipcRenderer.removeListener(DESKTOP_WINDOW_VISIBILITY_CHANNEL, listener)
    },
    /**
     * 应用内自我更新（T736：invoke 为主 + 单订阅；载荷全为窄对象，⛔ 无任意路径/命令）
     * @description 安装时机由用户显式触发（`restartToInstall`），下载完成不自动安装。
     */
    update: {
        getStatus: (): Promise<DesktopUpdateStatus> =>
            ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.getStatus),
        check: (): Promise<DesktopUpdateStatus> =>
            ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.check),
        download: (): Promise<DesktopUpdateStatus> =>
            ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.download),
        restartToInstall: (options?: DesktopUpdateInstallOptions): Promise<void> =>
            ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.install, options ?? {}),
        openDownloadPage: (): Promise<void> =>
            ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.openDownloadPage),
        onStatus: (callback: (status: DesktopUpdateStatus) => void) => {
            const listener = (_event: unknown, status: DesktopUpdateStatus) => callback(status)
            ipcRenderer.on(DESKTOP_UPDATE_STATUS_CHANNEL, listener)
            // 回放已知初值：订阅方无需再等下一次状态变化（或先调 getStatus）
            if (lastUpdateStatus) callback(lastUpdateStatus)
            return () => ipcRenderer.removeListener(DESKTOP_UPDATE_STATUS_CHANNEL, listener)
        }
    }
})