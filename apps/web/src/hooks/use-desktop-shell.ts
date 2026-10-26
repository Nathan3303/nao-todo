/**
 * 桌面外壳能力（Web 桩实现）
 *
 * @description 桌面端能力（托盘常驻状态 / 开机自启开关 / 退出入口 / 唤醒主窗口）的唯一消费面：
 *              界面只看 `isDesktop` 与 `status`，**全部 no-op** ⇒ **Web 端行为零变化**（AC12）。
 *              桌面端在 `apps/desktop/src/renderer/src/hooks/use-desktop-shell.ts` 提供同名真实实现，
 *              由各自 `hooks/index.ts` 装配（两端同名导出，界面代码无需分支）。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC12 / AC13 / D1）
 * @see docs/reports/T543-arch-review.md（§二 2.1 use-desktop-shell 双实现）
 */
import { readonly, ref, type Ref } from 'vue'

/** 托盘三态（`unsupported` = 关窗即退出，旧行为） */
export type DesktopTrayStatus = 'available' | 'unconfirmed' | 'unsupported'

/** 自启状态（`enabled` 已生效；其余均为「未生效」类，须如实显示，AC10） */
export type DesktopAutostartStatus = 'enabled' | 'disabled' | 'not-effective' | 'needs-approval'

/** 设置页「桌面常驻」块的数据源 */
export interface DesktopShellStatus {
    tray: DesktopTrayStatus
    autostart: DesktopAutostartStatus
}

export interface DesktopShell {
    /** 是否为桌面端（Web ⇒ `false`，所有动作 no-op） */
    isDesktop: boolean
    /** 主进程回报的状态（Web 桩恒为静态值） */
    status: Readonly<Ref<DesktopShellStatus>>
    /** 是否已取到首份状态（桌面端首帧前为 false，避免闪一下错误状态） */
    loaded: Readonly<Ref<boolean>>
    /** 重新读取状态（自启被系统改动后「重试」用） */
    refresh(): Promise<void>
    /** 开关开机自启（以主进程回读为准） */
    setAutostart(enabled: boolean): Promise<void>
    /** 显示并聚焦主窗口（通知点击 / 设置页） */
    showMainWindow(): void
    /** 真退出（托盘不可见时的唯一退出路径） */
    quit(): void
}

/** Web 桩：非桌面端，全部 no-op（不许有副作用） */
export const useDesktopShell = (): DesktopShell => {
    const status = ref<DesktopShellStatus>({ tray: 'unsupported', autostart: 'not-effective' })
    return {
        isDesktop: false,
        status: readonly(status),
        loaded: readonly(ref(true)),
        refresh: async () => undefined,
        setAutostart: async () => undefined,
        showMainWindow: () => undefined,
        quit: () => undefined
    }
}