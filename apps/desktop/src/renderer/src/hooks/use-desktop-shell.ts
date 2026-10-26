/**
 * 桌面外壳能力（真实实现）
 *
 * @description 与 `apps/web/src/hooks/use-desktop-shell.ts`（Web 桩）**同名同形**，
 *              界面代码只看 `isDesktop` / `status`，无需端分支。全部动作经 preload 的窄封装
 *              （`window.desktopAPI`）转发主进程；无桥（Web / 测试）⇒ 保底为静态状态、动作 no-op。
 *              刻意**不加生命周期副作用**（不自动 refresh）：由使用方在挂载时调 `refresh()`，
 *              避免在非组件上下文（如 `index-view`）误触发 IPC。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC13 / AC9 / D1）
 * @see docs/reports/T543-arch-review.md（§二 2.1 use-desktop-shell 双实现）
 */
import { readonly, ref } from 'vue'
import type { DesktopShell, DesktopShellStatus } from '@nao-todo/webapp/src/hooks/use-desktop-shell'
import { getDesktopBridge } from '../desktop-bridge'

/** 桌面端实现（`status` 由主进程回报；开关与退出均以主进程为准） */
export const useDesktopShell = (): DesktopShell => {
    const bridge = getDesktopBridge()
    const status = ref<DesktopShellStatus>({ tray: 'unsupported', autostart: 'not-effective' })
    const loaded = ref(false)

    const refresh = async (): Promise<void> => {
        if (!bridge) return
        try {
            status.value = await bridge.getShellStatus()
            loaded.value = true
        } catch (error) {
            // 主进程不可达（退出中 / 窗口销毁中）：保留上一份状态，不清零误导用户
            console.error('[desktop] 读取桌面常驻状态失败', error)
        }
    }

    const setAutostart = async (enabled: boolean): Promise<void> => {
        if (!bridge) return
        try {
            const result = await bridge.setAutostart(enabled)
            // 以主进程回读为准（AC10：写入成功不等于已生效）
            status.value = { ...status.value, autostart: result.autostart }
        } catch (error) {
            console.error('[desktop] 设置开机自启失败', error)
        }
    }

    return {
        isDesktop: Boolean(bridge?.isDesktop),
        status: readonly(status),
        loaded: readonly(loaded),
        refresh,
        setAutostart,
        showMainWindow: () => {
            void bridge?.showMainWindow()
        },
        quit: () => {
            void bridge?.quit()
        }
    }
}