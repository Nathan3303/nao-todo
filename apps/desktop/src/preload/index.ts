import { contextBridge, ipcRenderer } from 'electron'
import {
    DESKTOP_IPC_CHANNELS,
    DESKTOP_ONEWAY_CHANNELS,
    DESKTOP_POWER_EVENT_CHANNEL
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
    }
})