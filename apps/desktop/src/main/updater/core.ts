/**
 * 更新内核（AC1 / AC2 / AC4 / AC4b / AC5 / AC6 / AC8 / AC9b / AC11 主接缝）
 *
 * @description **electron 零依赖**：`checker` / `downloader` / `installer` / `env` / `syncGuard`
 *              五个端口全部注入 ⇒ 用例零网络、零文件系统（除缓存目录用真 temp dir）、零 electron。
 *              职责只有四件事：
 *              ① 持有**唯一**状态机（九态，见 `state.ts`）；
 *              ② 编排「检查 → 下载 → 安装」三段，并保证安装器**只在用户显式触发时**被调用；
 *              ③ 把检查结论与结果历史落「传入目录的 fs 面」（`store.ts`）；
 *              ④ **前置 gate（AC4b）**：安装形态为 `download-page`（未打包开发态 / deb / macOS）
 *                 ⇒ 初始态即 `unsupported`，**任何检查都不发起**（`checker` 调用数恒 0）。
 *              全部对外方法**不抛异常**：失败一律收敛成 `failed` 状态 + 历史记录（AC4 / AC11）；
 *              失败原因**只以原因码**进入载荷与日志（AC9b：底层原文不外露）。
 * @see docs/prds/2026-11-20-desktop-self-update.md（§五 业务规则 / §七 AC）
 * @see docs/adr/2026-11-20-desktop-self-update.md（五端口 / autoDownload=false）
 */
import type {
    DesktopUpdateFailureReason,
    DesktopUpdateFailureStage,
    DesktopUpdateStatus
} from '@nao-todo/shared'
import { resolveInstallMode } from './install-mode'
import { createUpdateStateMachine, type UpdateStateMachine } from './state'
import { isCheckFresh, type UpdateStore } from './store'
import { isNewerVersion } from './version'

/** 检查端口（adapter 侧负责网络与超时；此处只承诺「成功返回版本」或「reject」） */
export interface UpdaterCheckerPort {
    check(): Promise<{ version: string; sizeBytes?: number }>
}

export interface UpdaterProgress {
    downloadedBytes?: number
    totalBytes?: number
    percent?: number
}

export interface UpdaterDownloadOutcome {
    ok: boolean
    /** 失败阶段（默认 `download`；校验未过 ⇒ `verify`，AC5） */
    stage?: Extract<DesktopUpdateFailureStage, 'download' | 'verify'>
    /** 失败原因（缺省 ⇒ `unknown`） */
    reason?: DesktopUpdateFailureReason
}

export interface UpdaterDownloadHandler {
    /** 进度回调（字段式声明：避免把方法当解构引用导致 `this` 丢失误报） */
    onProgress: (progress: UpdaterProgress) => void
}

export interface UpdaterDownloaderPort {
    download(handlers: UpdaterDownloadHandler): Promise<UpdaterDownloadOutcome>
}

/** 安装端口（只被 `install()` 调用；⛔ 下载完成不得自动调用） */
export interface UpdaterInstallerPort {
    install(): Promise<void> | void
}

/** 环境端口（所有环境读取集中在此，内核本身零 IO） */
export interface UpdaterEnvPort {
    /** 当前应用版本（`app.getVersion()`） */
    currentVersion(): string
    /** `process.platform` */
    platform: string
    /** `process.env.APPIMAGE` */
    appimage?: string | null
    /** `app.isPackaged` */
    isPackaged: boolean
    /** 打开更新下载页（系统浏览器） */
    openDownloadPage(): Promise<void> | void
}

/**
 * 同步护栏端口（AC9）
 * @description 语义 = 「安装前队列里还有没有未同步改动」。⚠️ **生产装配恒返回 `false`**
 *              （见 `index.ts`：主进程读不到渲染层队列，接上需新增 IPC，超出本期范围）
 *              ⇒ 生产链路的护栏**只有渲染层一道**；本端口的 `pending-sync` 分支当前只由
 *              单测覆盖（结构性保障，不是运行期防线）。
 */
export interface UpdaterSyncGuardPort {
    hasPendingChanges(): boolean
}

export type InstallBlockedReason = 'not-ready' | 'pending-sync'

export interface InstallOutcome {
    installed: boolean
    blocked?: InstallBlockedReason
}

export interface CreateUpdaterCoreOptions {
    env: UpdaterEnvPort
    checker: UpdaterCheckerPort
    downloader: UpdaterDownloaderPort
    installer: UpdaterInstallerPort
    syncGuard: UpdaterSyncGuardPort
    store: UpdateStore
    /** 时钟（默认 `Date.now`；用例注入固定时钟测 24h 边界） */
    now?: () => number
    /**
     * 本地日志出口（异常不得外抛；缺省静默）
     * @description 入参**已是脱敏摘要**（`describeFailureForLog`：只有原因码）—— AC9b 要求
     *              日志不得含本机路径 / 主机名 / `electron-updater` 原文，因此这里不给原始异常。
     *              ⛔ 不要改回 `(error: unknown) => void` 再自行 `console.error(error)`。
     */
    onError?: (summary: string) => void
}

export interface UpdaterCore {
    getStatus(): DesktopUpdateStatus
    subscribe(listener: (status: DesktopUpdateStatus) => void): () => void
    /**
     * 检查更新
     * @param options.manual `true` = 手动检查（**忽略 24h 缓存**，必发一次请求；AC4 / AC8）
     */
    check(options?: { manual?: boolean }): Promise<DesktopUpdateStatus>
    /** 开始下载（仅 `available` 且 `in-place`） */
    download(): Promise<DesktopUpdateStatus>
    /** 安装并重启（仅 `ready`；`force` = 用户已确认「仍要更新」，AC9） */
    install(options?: { force?: boolean }): Promise<InstallOutcome>
    /** 打开更新下载页（AC4 / AC7 降级出口） */
    openDownloadPage(): Promise<void>
}

/** 更新可用态（侧栏弱提示判据） */
export const isUpdateAvailableState = (state: DesktopUpdateStatus['state']): boolean =>
    state === 'available' || state === 'downloading' || state === 'ready'

const messageOf = (error: unknown): string => {
    if (error instanceof Error) return `${error.name}: ${error.message}`
    if (typeof error === 'string') return error
    return ''
}

/**
 * 把底层异常收窄成面向用户的原因码（⛔ 不外泄路径 / 主机名 / 内部编号）
 * @description 收窄规则取「网络栈错误码 + HTTP 状态 + electron-updater 错误名」三类；
 *              认不出的一律 `unknown`（文案仍是「可以再试一次」，不会误导成「已是最新」）。
 */
export const classifyFailure = (error: unknown): DesktopUpdateFailureReason => {
    const record =
        typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {}
    const code = typeof record.code === 'string' ? record.code : ''
    const statusCode = typeof record.statusCode === 'number' ? record.statusCode : 0
    const probe = `${code} ${messageOf(error)}`
    if (/ENOSPC|no space|disk full/i.test(probe)) return 'disk'
    if (
        /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ERR_INTERNET_DISCONNECTED|offline/i.test(
            probe
        )
    ) {
        return 'offline'
    }
    if (
        /ETIMEDOUT|ESOCKETTIMEDOUT|ERR_TIMED_OUT|ERR_CONNECTION_TIMED_OUT|timeout|timed out/i.test(
            probe
        )
    )
        return 'timeout'
    if (statusCode >= 500) return 'server'
    if (/404|403|ENOENT|not found|cannot find|ERR_UPDATER_/i.test(probe)) return 'server'
    return 'unknown'
}

/**
 * 本地日志的**脱敏摘要**（AC9b）
 * @description 输出只会是固定枚举内的原因码，⛔ 不含原始消息 / 本机绝对路径 / 主机名 /
 *              环境变量名。`onError` 的入参类型就是它的返回值 ⇒ **结构上**排除了
 *              「顺手把 `error.message` 写进日志」的可能（变异改坏会红，见 core 用例）。
 */
export const describeFailureForLog = (error: unknown): string =>
    `[update] failure reason=${classifyFailure(error)}`

const toIso = (at: number): string => new Date(at).toISOString()

/**
 * 按缓存 + 当前版本推导启动初值（AC8：重启后仍显示上次结果）
 * @description 三个特例：`readyVersion === 当前版本` ⇒ 本次启动装好了新版本（just-updated）；
 *              `readyVersion` 存在但不等于当前版本 ⇒ 已下载待重启（ready，用户上次点了「稍后」）；
 *              无缓存 ⇒ `idle`（从未检查）。
 */
const restoreStatus = (
    store: UpdateStore,
    env: UpdaterEnvPort,
    build: (
        input: Partial<DesktopUpdateStatus> & { state: DesktopUpdateStatus['state'] }
    ) => DesktopUpdateStatus
): DesktopUpdateStatus => {
    const currentVersion = env.currentVersion()
    const record = store.readCheck()
    if (!record) return build({ state: 'idle' })
    const lastCheckedAt = toIso(record.lastCheckAt)
    if (record.readyVersion) {
        if (record.readyVersion === currentVersion) {
            // 本次启动就是装好的版本 ⇒ 清标记，避免下次启动再报一次
            store.writeCheck({ readyVersion: undefined })
            return build({ state: 'just-updated', latestVersion: currentVersion, lastCheckedAt })
        }
        return build({
            state: 'ready',
            latestVersion: record.readyVersion,
            sizeBytes: record.sizeBytes,
            percent: 100,
            lastCheckedAt
        })
    }
    if (record.result === 'available' && isNewerVersion(record.latestVersion, currentVersion)) {
        return build({
            state: 'available',
            latestVersion: record.latestVersion,
            sizeBytes: record.sizeBytes,
            lastCheckedAt
        })
    }
    return build({ state: 'up-to-date', latestVersion: record.latestVersion, lastCheckedAt })
}

/**
 * 创建更新内核
 * @param options 五端口 + 缓存面 + 时钟
 */
export const createUpdaterCore = (options: CreateUpdaterCoreOptions): UpdaterCore => {
    const { env, checker, downloader, installer, syncGuard, store } = options
    const now = options.now ?? (() => Date.now())
    const installMode = resolveInstallMode({
        platform: env.platform,
        appimage: env.appimage,
        isPackaged: env.isPackaged
    })
    /**
     * 前置 gate（AC4b · 设计稿 §5）
     * @description `download-page`（未打包开发态 / Linux deb / macOS）⇒ 初始态即 `unsupported`，
     *              检查动作**不发请求**（态与文案不变）。状态机的 `unsupported` 出向白名单为空，
     *              所以即使将来有代码尝试把它推向 `checking` / `available`，也会被状态机拒绝。
     */
    const unsupported = installMode.mode === 'download-page'

    /** 组装状态：公共字段（当前版本 / 安装形态 / 提示位）一处给全，避免各处漏字段 */
    const build = (
        input: Partial<DesktopUpdateStatus> & { state: DesktopUpdateStatus['state'] }
    ): DesktopUpdateStatus => {
        const status: DesktopUpdateStatus = {
            state: input.state,
            currentVersion: env.currentVersion(),
            installMode: installMode.mode,
            updateAvailable: isUpdateAvailableState(input.state)
        }
        if (installMode.degradedReason) status.degradedReason = installMode.degradedReason
        return { ...status, ...input, updateAvailable: isUpdateAvailableState(input.state) }
    }

    const machine: UpdateStateMachine = createUpdateStateMachine(
        unsupported ? build({ state: 'unsupported' }) : restoreStatus(store, env, build)
    )
    /** 安装幂等闸（重复点击不二次调用安装器） */
    let installing = false
    /**
     * 已确认可下载的目标版本（`available` 起记下，供下载失败后「重试」直达下载）
     * @description 只由**成功的检查**写入：检查失败不得沿用旧目标（否则会拿旧版本复核）
     */
    let downloadTarget: string | null =
        machine.get().state === 'available' ? (machine.get().latestVersion ?? null) : null

    const check = async (checkOptions: { manual?: boolean } = {}): Promise<DesktopUpdateStatus> => {
        // AC4b：形态不支持应用内更新 ⇒ 前置 gate，**不发起任何请求**（`checker` 调用数恒 0）
        if (unsupported) return machine.get()
        const current = machine.get()
        // 检查中/下载中：忽略重复触发（按钮 disabled 的另一半保险）
        if (current.state === 'checking' || current.state === 'downloading') return current
        // P5：已下载待重启期不得被检查结果覆盖（否则已下载成果被抹掉）
        if (current.state === 'ready') return current
        // AC8：启动静默检查 24h 内最多一次（0 请求）；手动检查忽略缓存
        if (checkOptions.manual !== true && isCheckFresh(store.readCheck(), now())) return current

        machine.set(
            build({
                state: 'checking',
                latestVersion: current.latestVersion,
                lastCheckedAt: current.lastCheckedAt
            })
        )

        try {
            const result = await checker.check()
            const at = now()
            const newer = isNewerVersion(result.version, env.currentVersion())
            store.appendHistory({ at, kind: 'check', ok: true, version: result.version })
            if (newer) {
                downloadTarget = result.version
                store.writeCheck({
                    lastCheckAt: at,
                    latestVersion: result.version,
                    result: 'available',
                    sizeBytes: result.sizeBytes
                })
                return machine.set(
                    build({
                        state: 'available',
                        latestVersion: result.version,
                        sizeBytes: result.sizeBytes,
                        lastCheckedAt: toIso(at)
                    })
                )
            }
            // AC6：相等（或远端更旧/无法比较）⇒ 已是最新，⛔ 不出现「立即更新」
            store.writeCheck({
                lastCheckAt: at,
                latestVersion: result.version,
                result: 'up-to-date'
            })
            return machine.set(
                build({
                    state: 'up-to-date',
                    latestVersion: result.version,
                    lastCheckedAt: toIso(at)
                })
            )
        } catch (error) {
            options.onError?.(describeFailureForLog(error))
            // AC9b：只有原因码进载荷（⛔ `error.message` 原文不进状态、不进 IPC 推播）
            const reason = classifyFailure(error)
            const at = now()
            store.appendHistory({ at, kind: 'check', ok: false, reason })
            // AC4：失败必达 + ⛔ 不显示「已是最新」
            return machine.set(
                build({
                    state: 'failed',
                    failure: { stage: 'check', reason },
                    latestVersion: current.latestVersion,
                    lastCheckedAt: current.lastCheckedAt
                })
            )
        }
    }

    const download = async (): Promise<DesktopUpdateStatus> => {
        const current = machine.get()
        // 平台降级态只能打开下载页（AC7）
        if (current.installMode !== 'in-place') return current
        /**
         * 允许两种入口：① `available`（首次下载）；② `failed` 且失败发生在下载/校验阶段 ⇒ 直接重试
         * （AC5 的「可重试」不必让用户先白跑一次检查）。检查失败不在此列。
         */
        const retryable =
            current.state === 'failed' &&
            current.failure !== undefined &&
            current.failure.stage !== 'check' &&
            downloadTarget !== null
        if (current.state !== 'available' && !retryable) return current
        const version =
            current.state === 'available' ? (current.latestVersion ?? '') : (downloadTarget ?? '')

        machine.set(
            build({
                ...current,
                state: 'downloading',
                downloadedBytes: 0,
                percent: undefined
            })
        )

        let outcome: UpdaterDownloadOutcome
        try {
            outcome = await downloader.download({
                onProgress: (progress) => {
                    const status = machine.get()
                    if (status.state !== 'downloading') return
                    machine.set(
                        build({
                            ...status,
                            downloadedBytes: progress.downloadedBytes,
                            totalBytes: progress.totalBytes,
                            percent: progress.percent
                        })
                    )
                }
            })
        } catch (error) {
            options.onError?.(describeFailureForLog(error))
            outcome = { ok: false, stage: 'download', reason: classifyFailure(error) }
        }

        const at = now()
        if (outcome.ok) {
            // 下载完 ≠ 已安装：只记 readyVersion 待用户点「立即重启更新」（AC2）
            store.writeCheck({ readyVersion: version })
            store.appendHistory({ at, kind: 'download', ok: true, version })
            const status = machine.get()
            return machine.set(
                build({
                    ...status,
                    state: 'ready',
                    latestVersion: version,
                    percent: 100,
                    downloadedBytes: status.totalBytes ?? status.downloadedBytes
                })
            )
        }

        // AC5：中断 / 校验失败 ⇒ 不进入 ready，失败原因可读且可重试
        const reason = outcome.reason ?? 'unknown'
        store.appendHistory({ at, kind: 'download', ok: false, reason, version })
        return machine.set(
            build({
                state: 'failed',
                failure: { stage: outcome.stage ?? 'download', reason },
                latestVersion: version,
                lastCheckedAt: machine.get().lastCheckedAt
            })
        )
    }

    const install = async (installOptions: { force?: boolean } = {}): Promise<InstallOutcome> => {
        const current = machine.get()
        if (current.state !== 'ready' || installing)
            return { installed: false, blocked: 'not-ready' }
        // AC9：未同步队列非空且用户未二次确认 ⇒ 不安装（安装器调用数保持 0，已下载状态保留）
        // ⚠️ 生产装配的 `syncGuard` 恒 `false` ⇒ 该分支在生产链路上不触发（护栏在渲染层）
        if (installOptions.force !== true && syncGuard.hasPendingChanges()) {
            return { installed: false, blocked: 'pending-sync' }
        }
        installing = true
        const version = current.latestVersion ?? ''
        store.appendHistory({ at: now(), kind: 'install', ok: true, version })
        try {
            await installer.install()
        } catch (error) {
            // 安装期失败：保留 ready 态（用户可重试），只落历史与日志
            installing = false
            options.onError?.(describeFailureForLog(error))
            store.appendHistory({
                at: now(),
                kind: 'install',
                ok: false,
                reason: classifyFailure(error),
                version
            })
            return { installed: false }
        }
        return { installed: true }
    }

    const openDownloadPage = async (): Promise<void> => {
        try {
            await env.openDownloadPage()
        } catch (error) {
            options.onError?.(describeFailureForLog(error))
        }
    }

    return {
        getStatus: () => machine.get(),
        subscribe: (listener) => machine.subscribe(listener),
        check,
        download,
        install,
        openDownloadPage
    }
}