import { contextBridge } from 'electron'

/**
 * 最小桌面能力桥：为后续桌面原生能力（系统通知、托盘、窗口控制等）留口
 */
contextBridge.exposeInMainWorld('desktopAPI', {
    platform: process.platform,
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
    }
})