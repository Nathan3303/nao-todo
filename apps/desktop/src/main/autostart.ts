/**
 * 开机自启（AC4 / AC10 / R5 / R6 / R13 / §五 5.4）
 *
 * @description 核心红线：**「写入成功」≠「已生效」** —— 状态一律以**系统回读**为准：
 *              - Windows：`openAtLogin && executableWillLaunchAtLogin`（任务管理器禁用可检出）；
 *              - macOS：`status === 'enabled'`（13+ 可能 `requires-approval`，ad-hoc 签名可能 `not-registered`）；
 *              - Linux：Electron 43 **无** Linux API（类型定义仅 `darwin,win32`）⇒ 自写
 *                `~/.config/autostart/nao-todo.desktop`，回读「文件存在 + 未 `Hidden` + 未被禁用」。
 *                AppImage 必须用 `process.env.APPIMAGE`（`execPath` 是每次不同的临时挂载点，R5/R13）。
 *              持久化语义（§五 5.4）：首次运行写入开启意图；用户关过（`autostartUserDisabled`）此后
 *              **永不自动重开**；系统侧被禁**不偷偷改回**，只显示「未生效」+ 重试。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC4 / AC10 / D0② / D4）
 * @see docs/reports/T543-arch-review.md（§四 平台矩阵 / §五 5.4 / R5 / R6 / R13）
 */
import { dirname, join } from 'node:path'

/** 自启状态：`enabled` 已生效 · `disabled` 用户明确关闭 · `not-effective` 未生效 · `needs-approval` 需系统批准 */
export type AutostartStatus = 'enabled' | 'disabled' | 'not-effective' | 'needs-approval'

/** Electron `app.getLoginItemSettings()` 的相关字段 */
export interface LoginItemSettings {
    openAtLogin: boolean
    executableWillLaunchAtLogin?: boolean
    /** macOS：`not-registered` / `enabled` / `requires-approval` / `not-found`（Electron 口径） */
    status?: 'enabled' | 'requires-approval' | 'not-registered' | 'not-found' | 'enabled-hidden'
}

/** Electron `app.setLoginItemSettings()` 的相关字段 */
export interface LoginItemSettingsInput {
    openAtLogin: boolean
    args?: string[]
    openAsHidden?: boolean
}

/** 注入的文件系统面（单测用内存 fs；生产传 `node:fs`） */
export interface FsLike {
    existsSync(path: string): boolean
    readFileSync(path: string, encoding: 'utf8'): string
    writeFileSync(path: string, content: string): void
    mkdirSync(path: string, options: { recursive: boolean }): void
    renameSync(from: string, to: string): void
    unlinkSync(path: string): void
}

export interface AutostartDeps {
    platform: string
    env: Record<string, string | undefined>
    execPath: string
    homeDir: string
    fs: FsLike
    getLoginItemSettings(): LoginItemSettings
    setLoginItemSettings(settings: LoginItemSettingsInput): void
}

/** Linux 自启条目相对 `$HOME` 的路径（freedesktop autostart spec） */
export const LINUX_AUTOSTART_RELATIVE_PATH = '.config/autostart/nao-todo.desktop'

/** 默认应用名（桌面条目 `Name=`） */
const DEFAULT_APP_NAME = 'NaoTodo'

/** Linux 自启条目落盘路径 */
export const linuxAutostartFilePath = (homeDir: string): string =>
    join(homeDir, LINUX_AUTOSTART_RELATIVE_PATH)

/**
 * 生成 freedesktop 自启 `.desktop` 内容
 * @param options `execPath` = 可执行文件；`appImagePath` = AppImage 本体路径（优先）；
 *                `appName` = 展示名；`hidden` = 标记不启动（关闭自启时）
 */
export const buildLinuxAutostartEntry = (options: {
    execPath: string
    appImagePath?: string
    appName?: string
    hidden?: boolean
}): string => {
    const target = options.appImagePath || options.execPath
    const lines = [
        '[Desktop Entry]',
        'Type=Application',
        `Name=${options.appName || DEFAULT_APP_NAME}`,
        `Exec="${target}" --autostart`,
        // TryExec：文件被移动/删除后 DE 不会尝试启动（R13：残留条目不生效，而不是报错）
        `TryExec=${target}`,
        'X-GNOME-Autostart-enabled=true',
        ...(options.hidden ? ['Hidden=true'] : [])
    ]
    return `${lines.join('\n')}\n`
}

/** 解析 desktop 条目的键值（只取 `Key=value` 行） */
const parseDesktopEntry = (content: string): Map<string, string> => {
    const entries = new Map<string, string>()
    for (const line of content.split(/\r?\n/)) {
        const matched = /^([A-Za-z0-9-]+)\s*=\s*(.*)$/.exec(line.trim())
        if (matched?.[1] !== undefined) entries.set(matched[1], matched[2] ?? '')
    }
    return entries
}

/** Windows 回读：两个条件都满足才算生效 */
const readWindowsStatus = (settings: LoginItemSettings): AutostartStatus =>
    settings.openAtLogin && settings.executableWillLaunchAtLogin === true
        ? 'enabled'
        : 'not-effective'

/** macOS 回读：`status` 是唯一判据（`openAtLogin` 不代表注册成功） */
const readMacStatus = (settings: LoginItemSettings): AutostartStatus => {
    if (settings.status === 'enabled') return 'enabled'
    if (settings.status === 'requires-approval') return 'needs-approval'
    return 'not-effective'
}

/** Linux 回读：文件存在 + 未 `Hidden=true` + 未被 `X-GNOME-Autostart-enabled=false` 关掉 */
const readLinuxStatus = (deps: AutostartDeps): AutostartStatus => {
    const path = linuxAutostartFilePath(deps.homeDir)
    if (!deps.fs.existsSync(path)) return 'not-effective'
    let content = ''
    try {
        content = deps.fs.readFileSync(path, 'utf8')
    } catch {
        // 读不到 ⇒ 视为未生效（不得谎报已开启，AC10）
        return 'not-effective'
    }
    const entries = parseDesktopEntry(content)
    if ((entries.get('Hidden') ?? '').toLowerCase() === 'true') return 'not-effective'
    if ((entries.get('X-GNOME-Autostart-enabled') ?? '').toLowerCase() === 'false')
        return 'not-effective'
    return 'enabled'
}

/**
 * 读取自启状态（**唯一**「已生效」判据，AC10）
 * @param deps 注入依赖
 */
export const readAutostartStatus = (deps: AutostartDeps): AutostartStatus => {
    if (deps.platform === 'win32') return readWindowsStatus(deps.getLoginItemSettings())
    if (deps.platform === 'darwin') return readMacStatus(deps.getLoginItemSettings())
    return readLinuxStatus(deps)
}

/** 原子写（tmp + rename）：避免断电/并发写坏条目 */
const writeFileAtomic = (deps: AutostartDeps, path: string, content: string): void => {
    const tmp = `${path}.tmp`
    deps.fs.mkdirSync(dirname(path), { recursive: true })
    deps.fs.writeFileSync(tmp, content)
    try {
        deps.fs.renameSync(tmp, path)
    } catch (error) {
        // rename 失败不得留下 tmp 残渣
        try {
            deps.fs.unlinkSync(tmp)
        } catch {
            /* tmp 可能已不存在 */
        }
        throw error
    }
}

/** 写 Linux 自启条目（失败 ⇒ 交调用方降级为 `not-effective`） */
const setLinuxAutostart = (enabled: boolean, deps: AutostartDeps): AutostartStatus => {
    const path = linuxAutostartFilePath(deps.homeDir)
    const content = buildLinuxAutostartEntry({
        execPath: deps.execPath,
        // AppImage：execPath 指向临时挂载点，必须改用本体路径（R5/R13）
        appImagePath: deps.env.APPIMAGE,
        hidden: !enabled
    })
    try {
        writeFileAtomic(deps, path, content)
    } catch {
        return 'not-effective'
    }
    return enabled ? readAutostartStatus(deps) : 'disabled'
}

/**
 * 开启 / 关闭开机自启
 * @description 关闭时返回 `disabled`（用户意图明确）；开启时**以回读为准** ——
 *              写成功但系统未生效必须返回 `not-effective`（AC10 不谎报）。
 * @param enabled 是否开启
 * @param deps 注入依赖
 */
export const setAutostart = (enabled: boolean, deps: AutostartDeps): AutostartStatus => {
    if (deps.platform === 'linux') return setLinuxAutostart(enabled, deps)

    try {
        deps.setLoginItemSettings(
            deps.platform === 'win32'
                ? { openAtLogin: enabled, args: ['--autostart'] }
                : { openAtLogin: enabled }
        )
    } catch {
        return 'not-effective'
    }
    if (!enabled) return 'disabled'
    return readAutostartStatus(deps)
}

/**
 * 是否应在启动时自动写入「开启自启」意图（D0② 默认开启 + §五 5.4 不反复骚扰）
 * @param state `hasUserRecord` = `userData` 已有记录；`autostartUserDisabled` = 用户关过
 */
export const shouldAutoEnableAutostart = (state: {
    hasUserRecord: boolean
    autostartUserDisabled: boolean
}): boolean => !state.hasUserRecord && !state.autostartUserDisabled