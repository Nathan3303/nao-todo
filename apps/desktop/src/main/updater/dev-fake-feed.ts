/**
 * 开发态**假更新源**（T748 · 仅供本地走查九态，生产恒不生效）
 *
 * @description 为什么需要它：未打包开发态按 AC4b 一律落 `unsupported`（`check()` 不发请求），
 *              于是 `available` / `downloading` / `ready` / `failed` / `just-updated` 在本地
 *              永远看不到，用户无法在验收前把九态点一遍。
 *              本模块只做一件事：**把 `checker` / `downloader` / `installer` 三个端口换成假的**，
 *              内核（`core.ts`）与状态机（`state.ts`）、渲染层**零改动**（⛔ 内核里没有 dev 分支）。
 *              三条安全边界：
 *              ① **启用条件两重**：`app.isPackaged === false` **且** `NAO_UPDATE_FAKE_FEED` 非空；
 *                 打包态在 `assembleUpdatePorts` **第一行**就返回真实端口 ⇒ 不读配置、不替换端口
 *                 （⛔ 生产即使设了该环境变量也完全不生效）；
 *              ② **不联网**：假端口只读一个本地 JSON 配置，零 `net` / 零 `electron-updater`
 *                 （本文件也不 import `electron`：`isPackaged` 由装配方显式传入）；
 *              ③ **不写死路径**：配置路径**只来自环境变量**，内容来自该文件。
 *
 *              配置格式（JSON，路径放 `NAO_UPDATE_FAKE_FEED`）：
 *              ```json
 *              {
 *                  "version": "9.9.9",
 *                  "sizeBytes": 157286400,
 *                  "check": { "fail": "offline" },
 *                  "download": { "fail": "verify", "steps": 8, "intervalMs": 400 }
 *              }
 *              ```
 *              - `version`：假远端版本。**大于**当前版本 ⇒ `available`；**等于** ⇒ `up-to-date`；
 *              - `sizeBytes`：可选，走查要与下载进度联动时给（不给则不显示体积/百分比）；
 *              - `check.fail`：`offline` / `timeout` / `server` ⇒ 检查失败（校验失败属于下载阶段，
 *                写在这里会被判配置非法，避免走查时误以为「校验失败没生效」）；
 *              - `download.fail`：`offline` / `timeout` / `server` / `verify` ⇒ 下载/校验失败；
 *              - `download.steps` / `download.intervalMs`：进度推进的档数与每档间隔（可快可慢）。
 *              **每次点击都重新读文件** ⇒ 改完 JSON 不必重启 Electron 就能切场景（连续走查）。
 * @see docs/prds/2026-11-20-desktop-self-update.md（§七 可测性前置 / AC4b）
 * @see apps/desktop/README.md（「走查『关于与更新』九态」）
 */
import { readFileSync } from 'node:fs'
import type {
    UpdaterCheckerPort,
    UpdaterDownloaderPort,
    UpdaterDownloadOutcome,
    UpdaterEnvPort,
    UpdaterInstallerPort,
    UpdaterProgress
} from './core'

/** 启用开关（值 = 假源配置文件的路径；相对路径按 Electron 进程 cwd 解析） */
export const FAKE_FEED_ENV_KEY = 'NAO_UPDATE_FAKE_FEED'

/** 未配置进度时的默认档数与档间隔（4 × 400ms ≈ 1.6s，够看清「正在下载」又不至于等太久） */
export const FAKE_FEED_DEFAULT_STEPS = 4
export const FAKE_FEED_DEFAULT_INTERVAL_MS = 400

/** 检查阶段可用的失败原因（校验失败只发生在下载阶段，故不含 `verify`） */
const CHECK_FAIL_REASONS = ['offline', 'timeout', 'server'] as const
/** 下载阶段可用的失败原因（`verify` = 下载完成但校验未过，AC5） */
const DOWNLOAD_FAIL_REASONS = ['offline', 'timeout', 'server', 'verify'] as const

export type FakeFeedCheckFailReason = (typeof CHECK_FAIL_REASONS)[number]
export type FakeFeedDownloadFailReason = (typeof DOWNLOAD_FAIL_REASONS)[number]

export interface FakeFeedCheckSection {
    fail?: FakeFeedCheckFailReason
}

export interface FakeFeedDownloadSection {
    fail?: FakeFeedDownloadFailReason
    /** 进度档数（≥1；默认 `FAKE_FEED_DEFAULT_STEPS`） */
    steps?: number
    /** 每档间隔毫秒（≥0；默认 `FAKE_FEED_DEFAULT_INTERVAL_MS`，`0` = 立即跑完） */
    intervalMs?: number
}

export interface FakeFeedConfig {
    /** 假远端版本号（`available` / `up-to-date` 由它与当前版本的比较决定） */
    version: string
    /** 更新包体积（字节；不给则不显示体积与百分比，⛔ 不编数字） */
    sizeBytes?: number
    check?: FakeFeedCheckSection
    download?: FakeFeedDownloadSection
}

/** 配置非法（⛔ 不静默兜默认值：走查时看错场景比报错更难查） */
export class FakeFeedConfigError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'FakeFeedConfigError'
    }
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null

/** 取枚举内的失败原因（越界 ⇒ 抛配置错误，带上允许值清单） */
const pickFailReason = <T extends string>(
    value: unknown,
    allowed: readonly T[],
    where: string
): T | undefined => {
    if (value === undefined) return undefined
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
        return value as T
    }
    throw new FakeFeedConfigError(`${where} 只能是 ${allowed.join(' / ')}`)
}

/** 取非负数（`steps` 另在小节里抬到 ≥1） */
const pickNumber = (value: unknown, where: string): number | undefined => {
    if (value === undefined) return undefined
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new FakeFeedConfigError(`${where} 必须是非负数`)
    }
    return Math.round(value)
}

const readCheckSection = (value: unknown): FakeFeedCheckSection | undefined => {
    const record = asRecord(value)
    if (!record) return undefined
    const fail = pickFailReason(record.fail, CHECK_FAIL_REASONS, 'check.fail')
    return fail === undefined ? undefined : { fail }
}

const readDownloadSection = (value: unknown): FakeFeedDownloadSection | undefined => {
    const record = asRecord(value)
    if (!record) return undefined
    const section: FakeFeedDownloadSection = {}
    const fail = pickFailReason(record.fail, DOWNLOAD_FAIL_REASONS, 'download.fail')
    if (fail !== undefined) section.fail = fail
    const steps = pickNumber(record.steps, 'download.steps')
    if (steps !== undefined) section.steps = Math.max(1, steps)
    const intervalMs = pickNumber(record.intervalMs, 'download.intervalMs')
    if (intervalMs !== undefined) section.intervalMs = intervalMs
    return Object.keys(section).length > 0 ? section : undefined
}

/**
 * 解析假源配置
 * @param source JSON 文本（文件内容）
 * @throws FakeFeedConfigError 非法 JSON / 缺 `version` / 字段越界
 */
export const parseFakeFeedConfig = (source: string): FakeFeedConfig => {
    let parsed: unknown
    try {
        parsed = JSON.parse(source)
    } catch {
        throw new FakeFeedConfigError('配置不是合法 JSON')
    }
    const record = asRecord(parsed)
    if (!record) throw new FakeFeedConfigError('配置必须是一个 JSON 对象')
    const version = typeof record.version === 'string' ? record.version.trim() : ''
    if (version.length === 0) throw new FakeFeedConfigError('缺少 version（假远端版本号）')
    const config: FakeFeedConfig = { version }
    const sizeBytes = pickNumber(record.sizeBytes, 'sizeBytes')
    if (sizeBytes !== undefined && sizeBytes > 0) config.sizeBytes = sizeBytes
    const check = readCheckSection(record.check)
    if (check) config.check = check
    const download = readDownloadSection(record.download)
    if (download) config.download = download
    return config
}

/** 定时器最小面（注入以便用例零等待；缺省 `setTimeout`） */
export interface FakeFeedTimer {
    setTimeout(callback: () => void, delayMs: number): unknown
}

export interface UpdaterPortsBundle {
    checker: UpdaterCheckerPort
    downloader: UpdaterDownloaderPort
    installer: UpdaterInstallerPort
    env: UpdaterEnvPort
}

export interface CreateFakeFeedPortsOptions {
    /** 真实 env（假源只覆盖 `currentVersion` / `platform` / `appimage` / `isPackaged` 四项，其余透传） */
    realEnv: UpdaterEnvPort
    /** 每次检查 / 下载 / 安装时重新读配置 ⇒ 改 JSON 即切场景（连续走查） */
    loadConfig: () => FakeFeedConfig
    timer?: FakeFeedTimer
}

const defaultTimer: FakeFeedTimer = {
    setTimeout: (callback, delayMs) => setTimeout(callback, delayMs)
}

/**
 * 造一个能被内核 `classifyFailure` 收窄成对应原因码的假错误
 * @description 只借「网络栈错误码 / HTTP 状态 / 校验错误名」三类特征，⛔ 不含本机路径与主机名。
 */
const fakeError = (reason: FakeFeedCheckFailReason): Error => {
    switch (reason) {
        case 'offline':
            return Object.assign(new Error('fake feed offline'), { code: 'ENOTFOUND' })
        case 'timeout':
            return Object.assign(new Error('fake feed timeout'), { code: 'ETIMEDOUT' })
        case 'server':
            return Object.assign(new Error('fake feed server error'), { statusCode: 503 })
    }
}

/** 单档进度（给了体积才计算已下载字节，⛔ 不编数字） */
const progressAt = (step: number, steps: number, sizeBytes?: number): UpdaterProgress => {
    const percent = Math.min(100, Math.round((step * 100) / steps))
    const progress: UpdaterProgress = { percent }
    if (sizeBytes !== undefined) {
        progress.totalBytes = sizeBytes
        progress.downloadedBytes = Math.round((sizeBytes * percent) / 100)
    }
    return progress
}

const waitFor = (timer: FakeFeedTimer, delayMs: number): Promise<void> =>
    new Promise((resolve) => {
        timer.setTimeout(() => resolve(), delayMs)
    })

/** 下载阶段失败（`offline` / `timeout` / `server` 本身就是原因码） */
const downloadFailure = (reason: FakeFeedCheckFailReason): UpdaterDownloadOutcome => ({
    ok: false,
    stage: 'download',
    reason
})

/** 校验失败（AC5：单独成阶段，⛔ 不得进「待重启」；原因码与真实 adapter 一致 = `unknown`） */
const verifyFailure = (): UpdaterDownloadOutcome => ({
    ok: false,
    stage: 'verify',
    reason: 'unknown'
})

/**
 * 创建假端口组（只替换三个动作端口 + 三项 env 读数）
 * @description `env` 的改动是**必要条件**而非额外功能：未打包时 `resolveInstallMode` 判
 *              `download-page`（AC4b）⇒ 内核前置 gate 恒 `unsupported`，`check()` 连 `checker`
 *              都不会调 ⇒ 不给假 env（`isPackaged: true` + 一种支持原地更新的平台）就永远走不到
 *              其余八态。真实 env 的 `openDownloadPage` 原样透传（系统浏览器，不经应用联网）。
 */
export const createFakeFeedPorts = (options: CreateFakeFeedPortsOptions): UpdaterPortsBundle => {
    const timer = options.timer ?? defaultTimer
    /** 假安装后的「当前版本」（内存态，进程退出即回到真实版本，⛔ 不落盘、不写死） */
    let installedVersion: string | null = null
    /** 上次成功「下载」的版本（安装时用它，避免走查中途改配置导致两个版本对不上） */
    let downloadedVersion: string | null = null

    const checker: UpdaterCheckerPort = {
        check: async () => {
            const config = options.loadConfig()
            if (config.check?.fail) throw fakeError(config.check.fail)
            return config.sizeBytes === undefined
                ? { version: config.version }
                : { version: config.version, sizeBytes: config.sizeBytes }
        }
    }

    const downloader: UpdaterDownloaderPort = {
        download: async ({ onProgress }) => {
            const config = options.loadConfig()
            const fail = config.download?.fail
            // 校验失败只可能在下载完成后出现（AC5）⇒ 先跑完进度再报；其余三种立即失败
            const runProgress = fail === undefined || fail === 'verify'
            if (runProgress) {
                const steps = config.download?.steps ?? FAKE_FEED_DEFAULT_STEPS
                const intervalMs = config.download?.intervalMs ?? FAKE_FEED_DEFAULT_INTERVAL_MS
                for (let step = 1; step <= steps; step++) {
                    if (intervalMs > 0) await waitFor(timer, intervalMs)
                    onProgress(progressAt(step, steps, config.sizeBytes))
                }
            }
            if (fail === undefined) {
                downloadedVersion = config.version
                return { ok: true }
            }
            if (fail === 'verify') return verifyFailure()
            return downloadFailure(fail)
        }
    }

    const installer: UpdaterInstallerPort = {
        /**
         * 假安装：**不退出、不替换文件**，只把「当前版本」在内存里推成假远端版本
         * @description 内核状态机不允许 `ready → just-updated`（`state.ts` 是生产语义），
         *              所以装配方（`index.ts`）在 `installed === true` 时按「真实链路的重启」语义
         *              重建一次内核：缓存里 `readyVersion` 已等于这里的当前版本 ⇒ 重建初值即
         *              `just-updated`（`restoreStatus`）。内核与状态机零改动。
         */
        install: () => {
            installedVersion = downloadedVersion ?? options.loadConfig().version
        }
    }

    const env: UpdaterEnvPort = {
        currentVersion: () => installedVersion ?? options.realEnv.currentVersion(),
        // 假安装形态：必须落 `in-place` 才能走到下载/安装（真实平台/打包态不参与判定）
        platform: 'win32',
        appimage: null,
        isPackaged: true,
        openDownloadPage: () => options.realEnv.openDownloadPage()
    }

    return { checker, downloader, installer, env }
}

export interface AssembleUpdatePortsInput {
    /** 真实端口组（`adapters/electron-updater.ts` 产出） */
    realPorts: UpdaterPortsBundle
    /** `app.isPackaged`（装配方显式传入 ⇒ 本模块零 `electron` 依赖，可参数化测试） */
    isPackaged: boolean
    /** 环境变量面（缺省由装配方传 `process.env`） */
    env: Record<string, string | undefined>
    /** 读配置文件（缺省同步读磁盘；用例注入） */
    readConfigFile?: (path: string) => string
    timer?: FakeFeedTimer
}

export interface AssembledUpdatePorts {
    ports: UpdaterPortsBundle
    /** 假源是否生效（生产 = `isPackaged === true` ⇒ 恒 `false`） */
    fake: boolean
    /** 启用失败原因（仅本地日志，供排障；⛔ 不进状态、不进 IPC 载荷） */
    notice?: string
}

const messageOf = (error: unknown): string =>
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)

/**
 * 装配更新端口：决定用**真实端口**还是**假端口**
 * @description 三重判据按顺序短路：
 *              ① `isPackaged === true`（**生产**）⇒ 真实端口，**第一行就返回**（不读文件、不看 env）；
 *              ② `NAO_UPDATE_FAKE_FEED` 为空 / 全空白 ⇒ 真实端口（开发态仍是 AC4b 的 `unsupported`）；
 *              ③ 配置读不出 / 非法 ⇒ 真实端口 + `notice`（⛔ 不让走查配置把关启动，ADR「启动不阻断」）。
 */
export const assembleUpdatePorts = (input: AssembleUpdatePortsInput): AssembledUpdatePorts => {
    // ① 生产硬闸（必须是第一行）：打包态永不替换端口、永不读配置
    if (input.isPackaged) return { ports: input.realPorts, fake: false }
    // ② 未设开关 ⇒ 保持现状（开发态 `unsupported`，零请求）
    const rawPath = input.env[FAKE_FEED_ENV_KEY]
    const configPath = typeof rawPath === 'string' ? rawPath.trim() : ''
    if (configPath.length === 0) return { ports: input.realPorts, fake: false }
    const read = input.readConfigFile ?? ((path: string) => readFileSync(path, 'utf8'))
    const loadConfig = (): FakeFeedConfig => parseFakeFeedConfig(read(configPath))
    // ③ 配置不可用 ⇒ 回退真实端口（开发态表现为 unsupported），只记一条本地日志
    try {
        loadConfig()
    } catch (error) {
        return {
            ports: input.realPorts,
            fake: false,
            notice: `[update] fake feed disabled: ${messageOf(error)}`
        }
    }
    return {
        ports: createFakeFeedPorts({
            realEnv: input.realPorts.env,
            loadConfig,
            timer: input.timer
        }),
        fake: true
    }
}