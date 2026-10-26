/**
 * 桌面端本地设置（AC14 / AC4 / §五 5.4）
 *
 * @description 只存两个标记，落 `userData/nao-desktop.json`（**不写 `localStorage`**，
 *              不动 K10 白名单）：
 *              - `autostartUserDisabled`：用户关过自启 ⇒ 此后**永不自动重开**；
 *              - `trayHintShown`：首次「收进托盘」提示只发一次。
 *              写盘为原子写（tmp + rename，防断电写坏）；文件损坏/字段缺失回默认值且**不抛错**
 *              （启动期崩在这里等于应用打不开）。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC14 / AC4）
 * @see docs/reports/T543-arch-review.md（§二 2.1 app-settings.ts / §五 5.4）
 */
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface DesktopAppSettings {
    autostartUserDisabled: boolean
    trayHintShown: boolean
}

/** 默认值（无记录 ⇒ 首次运行：未关过自启、未提示过） */
export const DEFAULT_DESKTOP_APP_SETTINGS: DesktopAppSettings = {
    autostartUserDisabled: false,
    trayHintShown: false
}

/** 设置文件名（`userData` 下） */
export const DESKTOP_APP_SETTINGS_FILE = 'nao-desktop.json'

/** 设置文件路径 */
export const desktopAppSettingsPath = (dir: string): string => join(dir, DESKTOP_APP_SETTINGS_FILE)

/** 取布尔字段（类型不对 ⇒ 用默认值，绝不把字符串当 true） */
const readFlag = (source: Record<string, unknown>, key: keyof DesktopAppSettings): boolean =>
    typeof source[key] === 'boolean' ? (source[key] as boolean) : DEFAULT_DESKTOP_APP_SETTINGS[key]

/**
 * 读取本地设置
 * @param dir `userData` 目录
 */
export const readAppSettings = (dir: string): DesktopAppSettings => {
    const path = desktopAppSettingsPath(dir)
    if (!existsSync(path)) return { ...DEFAULT_DESKTOP_APP_SETTINGS }
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_DESKTOP_APP_SETTINGS }
        const source = parsed as Record<string, unknown>
        return {
            autostartUserDisabled: readFlag(source, 'autostartUserDisabled'),
            trayHintShown: readFlag(source, 'trayHintShown')
        }
    } catch {
        // 损坏（非法 JSON / 读不到）⇒ 回默认值，下次写入自愈
        return { ...DEFAULT_DESKTOP_APP_SETTINGS }
    }
}

/**
 * 局部写入本地设置（保留其他键）
 * @param dir `userData` 目录（不存在则创建）
 * @param patch 要修改的字段
 * @returns 写入后的完整设置
 */
export const writeAppSettings = (
    dir: string,
    patch: Partial<DesktopAppSettings>
): DesktopAppSettings => {
    const next = { ...readAppSettings(dir), ...patch }
    const path = desktopAppSettingsPath(dir)
    const tmp = `${path}.tmp`
    mkdirSync(dir, { recursive: true })
    writeFileSync(tmp, `${JSON.stringify(next, null, 4)}\n`, 'utf8')
    try {
        renameSync(tmp, path)
    } catch (error) {
        try {
            // 兜底清理 tmp，避免目录里留下 `.tmp`（单测断言目录只应有正式文件）
            unlinkSync(tmp)
        } catch {
            /* tmp 可能已被移走 */
        }
        throw error
    }
    return next
}