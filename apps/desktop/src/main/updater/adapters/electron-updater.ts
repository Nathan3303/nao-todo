/**
 * `electron-updater` adapter（**唯一**出现 `electron-updater` 的地方）
 *
 * @description ADR 可测性前置 ②：第三方更新器整体包在端口后 —— 内核（`core.ts`）只认
 *              `checker` / `downloader` / `installer` / `env` 端口，单测注入假端口即可，
 *              **不触真实 `net`**。本文件负责三件「只有主进程能做」的事：
 *              ① 强制 `autoDownload=false` + `autoInstallOnAppQuit=false`（安装时机由用户决定）；
 *              ② 检查请求超时 ≤10s（PRD §六），超时后取消底层检查；
 *              ③ 把 `download-progress` 事件归一成 0–100 整数百分比（≤2 次/秒节流，设计稿 §7），
 *                 并把中断 / 校验失败（sha512）区分成不同阶段（AC5）。
 * @see docs/adr/2026-11-20-desktop-self-update.md（决策 / 可测性前置 ①②⑥）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC2 / AC5 / §六 性能）
 */
import { createRequire } from 'node:module'
import { app, shell } from 'electron'
import type {
    UpdaterCheckerPort,
    UpdaterDownloadOutcome,
    UpdaterDownloaderPort,
    UpdaterEnvPort,
    UpdaterInstallerPort,
    UpdaterProgress
} from '../core'

/** 更新下载页（Release 最新页；macOS / deb 的降级出口，AC4 / AC7） */
export const UPDATE_DOWNLOAD_PAGE_URL = 'https://github.com/Nathan3303/nao-todo/releases/latest'

/** 单次检查请求超时（NFR：≤10s） */
export const UPDATE_CHECK_TIMEOUT_MS = 10_000

/** 下载进度推播最小间隔（设计稿 §7：进度刷新 ≤2 次/秒） */
export const UPDATE_PROGRESS_INTERVAL_MS = 500

/** 检查超时（可辨识，便于收窄成 `timeout` 原因码） */
export class UpdateCheckTimeoutError extends Error {
    constructor() {
        super('update check timed out')
        this.name = 'UpdateCheckTimeoutError'
    }
}

interface UpdateFileLike {
    url: string
    size?: number
}

interface UpdateInfoLike {
    version: string
    files?: UpdateFileLike[]
    path?: string
}

interface UpdateCheckResultLike {
    updateInfo: UpdateInfoLike
    cancellationToken?: { cancel(): void }
}

interface DownloadProgressLike {
    total?: number
    transferred?: number
    percent?: number
}

/** `electron-updater` 的最小结构面（用例可注入假实例，不触真实网络） */
export interface ElectronUpdaterLike {
    autoDownload: boolean
    autoInstallOnAppQuit: boolean
    checkForUpdates(): Promise<UpdateCheckResultLike | null | undefined>
    downloadUpdate(): Promise<unknown>
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
    on(event: string, listener: (...args: unknown[]) => void): unknown
    off?(event: string, listener: (...args: unknown[]) => void): unknown
    removeListener?(event: string, listener: (...args: unknown[]) => void): unknown
}

interface ShellLike {
    openExternal(url: string): Promise<void>
}

interface AppLike {
    isPackaged: boolean
    getVersion(): string
}

export interface CreateElectronUpdaterPortsOptions {
    /** 缺省用真实 `autoUpdater`（用例注入假实例） */
    updater?: ElectronUpdaterLike
    shell?: ShellLike
    app?: AppLike
    env?: NodeJS.ProcessEnv
    /** 检查超时（缺省 10s） */
    timeoutMs?: number
    /** 进度推播最小间隔（缺省 500ms；用例可设 0） */
    progressIntervalMs?: number
}

/**
 * 惰性加载 `electron-updater`
 * @description ⛔ 不用顶层 `import`：主进程入口在 `whenReady` 之前就会加载本模块，
 *              依赖缺失/损坏若发生在**模块加载期**，`try/catch` 兜不住（窗口都创建不了）。
 *              放到调用点后，失败只让「更新器不可用」，符合 ADR「启动不阻断」。
 */
const requireFromMain = createRequire(__filename)

const loadAutoUpdater = (): ElectronUpdaterLike => {
    const loaded = requireFromMain('electron-updater') as { autoUpdater: ElectronUpdaterLike }
    return loaded.autoUpdater
}

export interface ElectronUpdaterPorts {
    checker: UpdaterCheckerPort
    downloader: UpdaterDownloaderPort
    installer: UpdaterInstallerPort
    env: UpdaterEnvPort
}

/**
 * 带超时的 Promise 竞速
 * @param promise 底层请求（逾期后仍可能成功 ⇒ 用 `onLate` 取消/忽略）
 * @param timeoutMs 超时毫秒
 * @param onLate 逾期后才 resolve 时的收尾回调（取消底层请求，避免泄漏）
 */
const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number,
    onLate?: (value: T) => void
): Promise<T> => {
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    // 逾期后才 resolve 的请求：静默收尾（失败无需处理，避免 unhandledRejection）
    promise.then(
        (value) => {
            if (timedOut) onLate?.(value)
        },
        () => {
            /* 逾期失败：已被超时分支覆盖 */
        }
    )
    const guard = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            timedOut = true
            reject(new UpdateCheckTimeoutError())
        }, timeoutMs)
    })
    try {
        return await Promise.race([promise, guard])
    } finally {
        if (timer) clearTimeout(timer)
    }
}

/** 从更新元数据里取当前平台产物体积（拿不到 ⇒ `undefined`，⛔ 不编数字） */
const pickSize = (info: UpdateInfoLike | undefined): number | undefined => {
    if (!info) return undefined
    const files = info.files ?? []
    const selected = info.path ? files.find((file) => file.url === info.path) : undefined
    const size = (selected ?? files[0])?.size
    return typeof size === 'number' && size > 0 ? size : undefined
}

/** 归一进度：`total` 未知 ⇒ 只给已下载字节，不给百分比（⛔ 不显示 0 MB） */
const normalizeProgress = (progress: DownloadProgressLike): UpdaterProgress => {
    const total =
        typeof progress.total === 'number' && progress.total > 0 ? progress.total : undefined
    const transferred =
        typeof progress.transferred === 'number' && progress.transferred >= 0
            ? progress.transferred
            : undefined
    const percent =
        total !== undefined && typeof progress.percent === 'number'
            ? Math.min(100, Math.max(0, Math.round(progress.percent)))
            : undefined
    return { downloadedBytes: transferred, totalBytes: total, percent }
}

const classifyDownloadOutcome = (error: unknown): UpdaterDownloadOutcome => {
    const message = error instanceof Error ? error.message : String(error)
    // 校验失败单独成态（AC5：校验未过不得进入待重启）
    const stage = /sha512|checksum|validate|corrupt/i.test(message) ? 'verify' : 'download'
    return { ok: false, stage }
}

/**
 * 创建 `electron-updater` 端口组
 * @description 构造时即强制 `autoDownload` / `autoInstallOnAppQuit` 为 `false`（ADR 决策）：
 *              下载与安装都必须由用户显式触发。
 */
export const createElectronUpdaterPorts = (
    options: CreateElectronUpdaterPortsOptions = {}
): ElectronUpdaterPorts => {
    const updater = options.updater ?? loadAutoUpdater()
    const shellLike: ShellLike = options.shell ?? { openExternal: (url) => shell.openExternal(url) }
    const appLike: AppLike = options.app ?? {
        isPackaged: app.isPackaged,
        getVersion: () => app.getVersion()
    }
    const processEnv = options.env ?? process.env
    const timeoutMs = options.timeoutMs ?? UPDATE_CHECK_TIMEOUT_MS
    const progressIntervalMs = options.progressIntervalMs ?? UPDATE_PROGRESS_INTERVAL_MS

    // 安装时机由用户显式触发：构建期与运行期都不得自动下载 / 自动装
    try {
        updater.autoDownload = false
        updater.autoInstallOnAppQuit = false
    } catch {
        /* 极端环境（假实例只读）不得阻断端口创建 */
    }

    const checker: UpdaterCheckerPort = {
        check: async () => {
            const pending = updater.checkForUpdates()
            const result = await withTimeout(pending, timeoutMs, (late) => {
                // 超时后才回来的检查：取消底层请求，避免它稍后自行触发事件
                try {
                    late?.cancellationToken?.cancel()
                } catch {
                    /* 取消失败：忽略 */
                }
            })
            const version = result?.updateInfo?.version
            if (typeof version !== 'string' || version.length === 0) {
                throw new Error('update check returned no version')
            }
            return { version, sizeBytes: pickSize(result?.updateInfo) }
        }
    }

    const downloader: UpdaterDownloaderPort = {
        download: async ({ onProgress }) => {
            let lastPublishedAt = 0
            const listener = (...args: unknown[]): void => {
                const progress = args[0] as DownloadProgressLike | undefined
                if (!progress) return
                const now = Date.now()
                const normalized = normalizeProgress(progress)
                const isFinal = normalized.percent === 100
                if (
                    progressIntervalMs > 0 &&
                    !isFinal &&
                    now - lastPublishedAt < progressIntervalMs
                ) {
                    return
                }
                lastPublishedAt = now
                try {
                    onProgress(normalized)
                } catch {
                    /* 订阅侧异常不得中断下载 */
                }
            }
            updater.on('download-progress', listener)
            try {
                await updater.downloadUpdate()
                return { ok: true }
            } catch (error) {
                return classifyDownloadOutcome(error)
            } finally {
                try {
                    if (typeof updater.off === 'function') {
                        updater.off('download-progress', listener)
                    } else if (typeof updater.removeListener === 'function') {
                        updater.removeListener('download-progress', listener)
                    }
                } catch {
                    /* 解绑失败：忽略（事件源随进程退出） */
                }
            }
        }
    }

    const installer: UpdaterInstallerPort = {
        // 静默安装关、装完自动拉起应用开：用户点了「立即重启更新」就该看到新版本
        install: () => {
            updater.quitAndInstall(false, true)
        }
    }

    const env: UpdaterEnvPort = {
        currentVersion: () => appLike.getVersion(),
        platform: process.platform,
        appimage: processEnv.APPIMAGE,
        isPackaged: appLike.isPackaged,
        openDownloadPage: () => shellLike.openExternal(UPDATE_DOWNLOAD_PAGE_URL)
    }

    return { checker, downloader, installer, env }
}