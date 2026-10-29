/**
 * 托盘常驻（AC2 / AC9 / D3 / R1）
 *
 * @description 判定口径唯一（`docs/reports/T543-arch-review.md` §四）：
 *              `new Tray()` **抛错** ⇒ `unsupported`（关窗回退旧行为）；
 *              构造**成功** ⇒ `available`；Linux 且 `XDG_CURRENT_DESKTOP` 含 GNOME / Unity ⇒
 *              `unconfirmed`（GNOME 无 AppIndicator 扩展时创建成功但不可见，无法程序化判定 ⇒
 *              **只影响文案与 P4 降级，不影响常驻**）。
 *              菜单只有两项：「打开 NaoTodo」「退出」（D3：不加任务操作、不加未读角标）。
 *              ⚠️ 图标在浅色/深色/高 DPI 下的可辨识度为**用户视觉验收**项（AC13）。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC2 / AC9 / AC13 / D3 / R1）
 * @see docs/reports/T543-arch-review.md（§四 平台矩阵 · 托盘判定口径）
 */

export type TrayStatus = 'available' | 'unconfirmed' | 'unsupported'

/** 基线 tooltip（D9：非空串 —— Electron `setToolTip('')` 等于移除 tooltip） */
export const DEFAULT_TRAY_TOOLTIP = 'NaoTodo'

/** 托盘实例最小面（Electron `Tray` 满足） */
export interface TrayLike {
    setToolTip?(toolTip: string): void
    setContextMenu(menu: unknown): void
    destroy(): void
}

/** 菜单项最小面（Electron `MenuItemConstructorOptions` 的子集） */
export interface TrayMenuItemLike {
    label: string
    click?: () => void
}

export interface CreateTrayDeps {
    /** `process.platform` */
    platform: string
    /** 进程环境（读 `XDG_CURRENT_DESKTOP`） */
    env: Record<string, string | undefined>
    /** 托盘图标路径（`build/tray/*`） */
    iconPath: string
    actions: { open(): void; quit(): void }
    /** 注入 Electron `Tray` 构造器（单测无需拉起 Electron） */
    Tray: new (iconPath: string) => TrayLike
    /** 注入 Electron `Menu` */
    Menu: { buildFromTemplate(template: readonly TrayMenuItemLike[]): unknown }
    /** 菜单文案（缺省中文；调用方可按语言传入） */
    labels?: { open: string; quit: string }
    /** 悬停提示（缺省 `NaoTodo`） */
    tooltip?: string
}

export interface TrayHandle {
    status: TrayStatus
    tray: TrayLike | null
    /** 写入 tooltip（不可用 / 已销毁 / 实现缺方法 ⇒ 静默 no-op，不抛） */
    setTooltip(text: string): void
    destroy(): void
}

/** Linux「创建成功但可能不可见」的桌面环境（GNOME / Unity 无 AppIndicator 扩展时托盘不显示） */
const UNCONFIRMED_DESKTOPS = ['gnome', 'unity']

/** 判定状态（构造成功后才有意义） */
const resolveStatus = (platform: string, env: Record<string, string | undefined>): TrayStatus => {
    if (platform !== 'linux') return 'available'
    const desktop = (env.XDG_CURRENT_DESKTOP ?? '').toLowerCase()
    return UNCONFIRMED_DESKTOPS.some((name) => desktop.includes(name)) ? 'unconfirmed' : 'available'
}

/**
 * 创建托盘（失败不抛错，降级为 `unsupported`）
 * @param deps 注入依赖（平台 / 环境 / 图标 / 动作 / Electron 构造器）
 */
export const createTray = (deps: CreateTrayDeps): TrayHandle => {
    let tray: TrayLike
    try {
        tray = new deps.Tray(deps.iconPath)
    } catch {
        // 托盘不可用（无 StatusNotifier 宿主 / 无图形会话）：不冒泡，交给生命周期回退旧行为
        return {
            status: 'unsupported',
            tray: null,
            setTooltip: () => undefined,
            destroy: () => undefined
        }
    }

    const labels = deps.labels ?? { open: '打开 NaoTodo', quit: '退出' }
    // 基线 tooltip（D9：非空串）：未显式指定时写默认基线；显式 `tooltip` 视为调用方自备文案，
    // 不在创建时重复写入。初始写入同样容忍托盘已销毁（AC8）
    if (deps.tooltip === undefined) {
        try {
            tray.setToolTip?.(DEFAULT_TRAY_TOOLTIP)
        } catch {
            // 托盘实现不可用：静默降级，不影响创建结果
        }
    }
    tray.setContextMenu(
        deps.Menu.buildFromTemplate([
            { label: labels.open, click: () => deps.actions.open() },
            { label: labels.quit, click: () => deps.actions.quit() }
        ])
    )

    return {
        status: resolveStatus(deps.platform, deps.env),
        tray,
        setTooltip: (text: string) => {
            try {
                tray.setToolTip?.(text)
            } catch {
                // 托盘已销毁 / 平台不支持：静默降级（AC8 不得有控制台错误）
            }
        },
        destroy: () => tray.destroy()
    }
}