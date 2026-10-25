/**
 * preload 暴露的桌面能力桥（渲染层类型 + 访问器）
 *
 * @description preload 经 `contextBridge` 暴露的唯一入口（`window.desktopAPI`），**只有**：
 *              状态读取 / 自启开关 / 显示主窗口 / 退出 / 休眠唤醒订阅。
 *              不暴露 `ipcRenderer`、不接受任意通道名、不传 token 与文件路径
 *              （安全语义见评审 §六）。
 * @see apps/desktop/src/preload/index.ts
 * @see docs/reports/T543-arch-review.md（§二 2.1 ipc.ts / §六）
 */
import type {
    DesktopAutostartStatus,
    DesktopTrayStatus
} from '@nao-todo/webapp/src/hooks/use-desktop-shell'

/** `getShellStatus` 返回值（= 设置页「桌面常驻」块的数据源） */
export interface DesktopShellStatusPayload {
    tray: DesktopTrayStatus
    autostart: DesktopAutostartStatus
}

/** preload 暴露面（窄：4 个调用 + 1 个订阅） */
export interface DesktopBridge {
    isDesktop: true
    platform: string
    versions: { electron: string; chrome: string; node: string }
    getShellStatus(): Promise<DesktopShellStatusPayload>
    setAutostart(enabled: boolean): Promise<{ autostart: DesktopAutostartStatus }>
    showMainWindow(): Promise<void>
    quit(): Promise<void>
    /** 系统从休眠恢复（返回取消订阅） */
    onPowerResume(callback: () => void): () => void
}

/**
 * 取桌面能力桥
 * @returns 桌面端返回桥对象；Web / 测试环境（无 preload）返回 `null`
 */
export const getDesktopBridge = (): DesktopBridge | null => {
    const globalScope = globalThis as { desktopAPI?: DesktopBridge }
    return globalScope.desktopAPI ?? null
}