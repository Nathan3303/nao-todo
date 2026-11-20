/**
 * 安装形态判定（AC7 · ADR 平台能力矩阵）
 *
 * @description **纯函数、零 IO、零 `electron` 依赖**：入参全部显式（`platform` / `APPIMAGE` /
 *              `isPackaged`），环境读取只发生在调用点（`adapters/electron-updater.ts`）。
 *              ⛔ 不做「试一次原地更新、失败再降级」—— 平台矩阵一次判定即定局（ADR 决策）。
 * @see docs/adr/2026-11-20-desktop-self-update.md（平台能力矩阵）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC3 / AC7）
 */
import type { DesktopUpdateInstallMode, DesktopUpdateManualReason } from '@nao-todo/shared'

export interface InstallModeInput {
    /** `process.platform` */
    platform: string
    /** `process.env.APPIMAGE`（仅 AppImage 运行时有值；未定义/null 均视为非 AppImage） */
    appimage?: string | null
    /** `app.isPackaged`（开发态无更新源，不提供原地更新） */
    isPackaged: boolean
}

export interface InstallModeResult {
    mode: DesktopUpdateInstallMode
    /** 仅 `download-page` 且能判定具体安装形态时给出（决定一行原因文案） */
    degradedReason?: DesktopUpdateManualReason
}

/**
 * 判定安装形态
 * - `darwin` ⇒ 下载页（ad-hoc 未签名，Squirrel.Mac 硬要求签名）
 * - `win32` 且已打包 ⇒ 原地（NSIS）
 * - `linux` 且有 `APPIMAGE` ⇒ 原地（AppImage 文件替换）
 * - 其余（含 Linux deb/rpm、开发态）⇒ 下载页
 */
export const resolveInstallMode = ({
    platform,
    appimage,
    isPackaged
}: InstallModeInput): InstallModeResult => {
    if (platform === 'darwin') return { mode: 'download-page', degradedReason: 'mac' }
    if (platform === 'win32') {
        return isPackaged ? { mode: 'in-place' } : { mode: 'download-page' }
    }
    if (platform === 'linux') {
        // AppImage 运行时由 electron-builder 注入 `APPIMAGE`（绝对路径）⇒ 判定非空即可
        if (isPackaged && typeof appimage === 'string' && appimage.length > 0) {
            return { mode: 'in-place' }
        }
        return { mode: 'download-page', degradedReason: 'deb' }
    }
    return { mode: 'download-page' }
}