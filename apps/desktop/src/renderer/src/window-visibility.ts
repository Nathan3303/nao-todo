import { getDesktopBridge, type DesktopBridge } from './desktop-bridge'

/**
 * 桌面窗口可见性 → 同步自动刷新门控（T654 / R-10 / AC5 桌面分支）
 *
 * @description 桌面端可见性**唯一**信号 = 主进程 `show` / `hide` → IPC（`nao:window-visibility`）。
 *              ⛔ **不得**用 `document.visibilityState`：`webPreferences.backgroundThrottling: false`
 *              使窗口隐藏到托盘后它**恒为 `visible`**（提醒引擎依赖这点）⇒ 拿它当门控 =
 *              「窗口在托盘里也照拉」且**无任何报错**，正是 R-10 点名要防的静默退化。
 *              桥缺失（Web / 旧 preload / 测试桩）⇒ 返回 no-op，由调用方决定是否退回 document。
 */

/** 可见性目标（实现面最小：`SyncRefreshRuntime` 满足） */
export interface WindowVisibilityTarget {
    setVisible(visible: boolean): void
}

/** 可见性订阅（preload 窄桥方法签名） */
export type WindowVisibilitySubscribe = (callback: (visible: boolean) => void) => () => void

/**
 * 绑定桌面窗口可见性
 * @param target 接收可见性的目标（自动刷新运行时）
 * @param bridge 桌面能力桥（缺省取 `window.desktopAPI`）
 * @returns 取消订阅（无桥 / 旧桥无该方法 ⇒ no-op）
 */
export const bindDesktopWindowVisibility = (
    target: WindowVisibilityTarget,
    bridge: Pick<DesktopBridge, 'onWindowVisibility'> | null = getDesktopBridge()
): (() => void) => {
    const subscribe = bridge?.onWindowVisibility
    if (typeof subscribe !== 'function') return () => {}
    return subscribe((visible) => target.setVisible(visible === true))
}

/** 桌面能力桥是否提供可见性信号（供装配层决定是否退回 document） */
export const hasWindowVisibilityBridge = (
    bridge: Pick<DesktopBridge, 'onWindowVisibility'> | null = getDesktopBridge()
): boolean => typeof bridge?.onWindowVisibility === 'function'