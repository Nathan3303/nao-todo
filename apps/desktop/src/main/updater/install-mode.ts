/**
 * 安装形态判定（AC7 · ADR 平台能力矩阵）
 *
 * @description **纯函数、零 IO、零 `electron` 依赖**：入参全部显式（`platform` / `APPIMAGE` /
 *              `isPackaged`），环境读取只发生在调用点（`adapters/electron-updater.ts`）。
 *              ⛔ 不做「试一次原地更新、失败再降级」—— 平台矩阵一次判定即定局（ADR 决策）。
 *              判定顺序（AC4b · 设计稿 §9 契约增补）：**先判 `isPackaged` 再判平台** ——
 *              开发态（未打包）**没有更新源**，先于平台落地为 `download-page` + `degradedReason: 'dev'`；
 *              否则 `linux + !isPackaged` 会落成 `deb`，把开发态说成「deb 版由系统包管理」（实报 bug）。
 * @see docs/adr/2026-11-20-desktop-self-update.md（平台能力矩阵）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC3 / AC4b / AC7）
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
    /** 仅 `download-page` 且能判定具体形态时给出（决定一行原因文案） */
    degradedReason?: DesktopUpdateManualReason
}

/**
 * 判定安装形态
 * - **未打包（开发态）⇒ 下载页 + `dev`（先于平台判定，AC4b）**
 * - `darwin` ⇒ 下载页（ad-hoc 未签名，Squirrel.Mac 硬要求签名）
 * - `win32` ⇒ 原地（NSIS）
 * - `linux` 且 `APPIMAGE` 非空 ⇒ 原地（AppImage 文件替换）
 * - 其余（含 Linux deb/rpm）⇒ 下载页
 */
export const resolveInstallMode = ({
    platform,
    appimage,
    isPackaged
}: InstallModeInput): InstallModeResult => {
    // ① 开发态优先：未打包 = 没有更新源，与平台无关（⛔ 不得落成 mac / deb）
    if (!isPackaged) return { mode: 'download-page', degradedReason: 'dev' }
    // ② 再按平台判定（此处恒已打包 ⇒ Windows 不再需要 isPackaged 分支）
    if (platform === 'darwin') return { mode: 'download-page', degradedReason: 'mac' }
    if (platform === 'win32') return { mode: 'in-place' }
    if (platform === 'linux') {
        // AppImage 运行时由 electron-builder 注入 `APPIMAGE`（绝对路径）⇒ 判定非空即可
        if (typeof appimage === 'string' && appimage.length > 0) return { mode: 'in-place' }
        return { mode: 'download-page', degradedReason: 'deb' }
    }
    return { mode: 'download-page' }
}