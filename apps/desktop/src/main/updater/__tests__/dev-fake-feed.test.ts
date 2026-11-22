import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import { classifyFailure, createUpdaterCore, type UpdaterCore, type UpdaterEnvPort } from '../core'
import {
    assembleUpdatePorts,
    FAKE_FEED_DEFAULT_INTERVAL_MS,
    FAKE_FEED_DEFAULT_STEPS,
    FAKE_FEED_ENV_KEY,
    FakeFeedConfigError,
    parseFakeFeedConfig,
    type AssembledUpdatePorts,
    type FakeFeedConfig,
    type UpdaterPortsBundle
} from '../dev-fake-feed'
import { createUpdateStore, type UpdateStore } from '../store'

/**
 * T748 · 开发态假更新源（仅供走查九态，生产必须完全不生效）
 *
 * @description 三条硬判据（全部可观测、零等待、零网络、零 electron）：
 *              ① **生产不生效**：`isPackaged === true` + 设了 `NAO_UPDATE_FAKE_FEED` ⇒ 端口仍是
 *                 真实那一组（**对象同一性**）、配置文件**零次读取**、`check()` 走真实 `checker`；
 *              ② **九态可达**：假源能产出 `available` / `up-to-date` / `failed(offline|timeout|
 *                 server|verify)` / `downloading`（进度按配置推进）/ `ready` / `just-updated`；
 *              ③ **不触真实 electron-updater**：假源模式下真实 `checker` 调用数 **0**，且本模块
 *                 源码不含 `electron` / `electron-updater` 模块说明符（静态断言）。
 *              计时器注入「立刻执行 + 记录延后毫秒」⇒ 进度用例**不真等**，同时把「可快可慢」
 *              变成可比对的数字（`delays`）。
 */

const START = 1_700_000_000_000
const FAKE_VERSION = '9.9.9'
const SIZE_BYTES = 157_286_400
const CURRENT_VERSION = '1.20.3'

const dirs: string[] = []

afterEach(() => {
    while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true })
})

const defaultConfig = (patch: Partial<FakeFeedConfig> = {}): FakeFeedConfig => ({
    version: FAKE_VERSION,
    sizeBytes: SIZE_BYTES,
    ...patch
})

interface HarnessOptions {
    /** 真实 `app.isPackaged`（缺省 `false` = 开发态） */
    isPackaged?: boolean
    /** 真实平台（缺省 `linux` + 无 `APPIMAGE` ⇒ 打包态会落 deb） */
    platform?: string
    /** `NAO_UPDATE_FAKE_FEED` 的值（`null` = 不设该环境变量；缺省 = 配置文件绝对路径） */
    envValue?: string | null
    /** 配置文件初始内容（对象或原始文本，后者用于非法配置） */
    config?: FakeFeedConfig | string
    /** 真实当前版本 */
    currentVersion?: string
}

interface Harness {
    /** 装配结果（假源是否生效 / 端口同一性 / 启用失败原因） */
    assembled: AssembledUpdatePorts
    /** 真实端口（断言「未被替换」用） */
    realPorts: UpdaterPortsBundle
    realChecker: { check: ReturnType<typeof vi.fn> }
    realDownloader: { download: ReturnType<typeof vi.fn> }
    realInstaller: { install: ReturnType<typeof vi.fn> }
    readConfigFile: ReturnType<typeof vi.fn>
    store: UpdateStore
    core: UpdaterCore
    statuses: DesktopUpdateStatus[]
    /** 注入的定时器收到的延后毫秒序列（「可快可慢」的可观测面） */
    delays: number[]
    /** 改写配置文件内容（走查中的场景切换；无需重启） */
    setConfig(config: FakeFeedConfig | string): void
    /** 按 index 的「假安装后重建」同一路径重建一次内核（同端口 + 同缓存） */
    rebuild(): UpdaterCore
}

const createHarness = (options: HarnessOptions = {}): Harness => {
    const dir = mkdtempSync(join(tmpdir(), 'nao-update-fake-'))
    dirs.push(dir)
    const store = createUpdateStore(dir)
    const configPath = join(dir, 'fake-feed.json')
    const files = new Map<string, string>([
        [configPath, JSON.stringify(options.config ?? defaultConfig())]
    ])
    if (typeof options.config === 'string') files.set(configPath, options.config)

    const readConfigFile = vi.fn((path: string) => {
        const content = files.get(path)
        if (content === undefined) throw new Error('ENOENT')
        return content
    })
    const delays: number[] = []
    const realEnv: UpdaterEnvPort = {
        currentVersion: () => options.currentVersion ?? CURRENT_VERSION,
        platform: options.platform ?? 'linux',
        appimage: null,
        isPackaged: options.isPackaged ?? false,
        openDownloadPage: vi.fn()
    }
    const realChecker = { check: vi.fn(async () => ({ version: '1.21.0', sizeBytes: 1 })) }
    const realDownloader = { download: vi.fn(async () => ({ ok: true })) }
    const realInstaller = { install: vi.fn() }
    const realPorts: UpdaterPortsBundle = {
        checker: realChecker,
        downloader: realDownloader,
        installer: realInstaller,
        env: realEnv
    }

    const envValue = options.envValue === undefined ? configPath : options.envValue
    const assembled = assembleUpdatePorts({
        realPorts,
        isPackaged: realEnv.isPackaged,
        env: envValue === null ? {} : { [FAKE_FEED_ENV_KEY]: envValue },
        readConfigFile,
        timer: {
            // 立刻执行回调（不真等），但把延后毫秒记下来供断言
            setTimeout: (callback, delayMs) => {
                delays.push(delayMs)
                callback()
                return delays.length
            }
        }
    })

    const statuses: DesktopUpdateStatus[] = []
    const build = (): UpdaterCore => {
        const core = createUpdaterCore({
            ...assembled.ports,
            syncGuard: { hasPendingChanges: () => false },
            store,
            now: () => START
        })
        core.subscribe((status) => statuses.push(status))
        return core
    }

    const harness: Harness = {
        assembled,
        realPorts,
        realChecker,
        realDownloader,
        realInstaller,
        readConfigFile,
        store,
        core: build(),
        statuses,
        delays,
        setConfig: (config) => {
            files.set(configPath, typeof config === 'string' ? config : JSON.stringify(config))
        },
        rebuild: () => {
            harness.core = build()
            return harness.core
        }
    }
    return harness
}

describe('生产恒不生效（isPackaged === true 且设了环境变量）', () => {
    it('端口仍是真实那一组、配置文件零次读取、检查走真实 checker', async () => {
        // 打包态的 win32 ⇒ 安装形态 in-place，能真正走到真实 checker（否则会落 AC4b 的 unsupported）
        const harness = createHarness({ isPackaged: true, platform: 'win32' })
        const { assembled, realChecker, readConfigFile } = harness

        // ① 对象同一性：假源根本没参与装配
        expect(assembled.fake).toBe(false)
        expect(assembled.ports).toBe(harness.realPorts)
        // ② 连配置文件都不读（不是「读了不用」）
        expect(readConfigFile).not.toHaveBeenCalled()

        // ③ 检查结果是真实 checker 的 1.21.0，而不是假配置里的 9.9.9
        const status = await harness.core.check({ manual: true })
        expect(status.state).toBe('available')
        expect(status.latestVersion).toBe('1.21.0')
        expect(realChecker.check).toHaveBeenCalledTimes(1)
    })

    it('生产且打包态下走下载页形态时，检查请求数仍为 0（AC4b 不变）', async () => {
        const harness = createHarness({ isPackaged: true })
        const status = await harness.core.check({ manual: true })
        expect(status.state).toBe('unsupported')
        expect(harness.realChecker.check).not.toHaveBeenCalled()
    })
})

describe('开发态未开假源 ⇒ 保持现状（AC4b 的 unsupported，零请求）', () => {
    it('未设环境变量：真实端口 + 零次读配置 + unsupported + 0 请求', async () => {
        const harness = createHarness({ envValue: null })
        expect(harness.assembled.fake).toBe(false)
        expect(harness.assembled.ports).toBe(harness.realPorts)
        expect(harness.readConfigFile).not.toHaveBeenCalled()

        const status = await harness.core.check({ manual: true })
        expect(status.state).toBe('unsupported')
        expect(status.degradedReason).toBe('dev')
        expect(harness.realChecker.check).not.toHaveBeenCalled()
    })

    it('环境变量全是空白 ⇒ 等同于未设（不启用假源）', () => {
        const harness = createHarness({ envValue: '   ' })
        expect(harness.assembled.fake).toBe(false)
        expect(harness.assembled.ports).toBe(harness.realPorts)
    })
})

describe('配置不可用 ⇒ 回退真实端口（不让走查配置把关启动）', () => {
    it.each([
        ['不是 JSON', '{ 这不是 json'],
        ['缺 version', JSON.stringify({ sizeBytes: 1 })],
        [
            'check.fail 写了 verify（校验失败属于下载阶段）',
            JSON.stringify({ version: '9.9.9', check: { fail: 'verify' } })
        ],
        ['download.steps 为负', JSON.stringify({ version: '9.9.9', download: { steps: -1 } })]
    ])('%s ⇒ fake = false + notice，且行为回到现状', async (_label, raw) => {
        const harness = createHarness({ config: raw })
        expect(harness.assembled.fake).toBe(false)
        expect(harness.assembled.ports).toBe(harness.realPorts)
        expect(harness.assembled.notice).toContain('fake feed disabled')
        // ⛔ notice 只进本地日志：不进状态载荷
        const status = await harness.core.check({ manual: true })
        expect(status.state).toBe('unsupported')
        expect(JSON.stringify(status)).not.toContain('fake feed disabled')
    })

    it('parseFakeFeedConfig 直接抛 FakeFeedConfigError（可读原因）', () => {
        expect(() => parseFakeFeedConfig('{')).toThrow(FakeFeedConfigError)
        expect(() => parseFakeFeedConfig(JSON.stringify({ version: '  ' }))).toThrow(/version/)
    })
})

describe('假源生效 ⇒ 九态可达', () => {
    it('available：假远端版本高于当前版本，安装形态为原地更新', async () => {
        const harness = createHarness()
        expect(harness.assembled.fake).toBe(true)

        const status = await harness.core.check({ manual: true })
        expect(status.state).toBe('available')
        expect(status.latestVersion).toBe(FAKE_VERSION)
        expect(status.sizeBytes).toBe(SIZE_BYTES)
        expect(status.installMode).toBe('in-place')
        expect(status.updateAvailable).toBe(true)
        expect(harness.statuses.map((item) => item.state)).toEqual(['checking', 'available'])
        // ③ 假源不触真实 electron-updater（真实 checker 调用数 0）
        expect(harness.realChecker.check).not.toHaveBeenCalled()
    })

    it('up-to-date：假远端版本等于当前版本 ⇒ 不出现「立即更新」', async () => {
        const harness = createHarness({ config: defaultConfig({ version: CURRENT_VERSION }) })
        const status = await harness.core.check({ manual: true })
        expect(status.state).toBe('up-to-date')
        expect(status.updateAvailable).toBe(false)
    })

    it.each(['offline', 'timeout', 'server'] as const)(
        'failed：check.fail = %s ⇒ failed(check, %s)，且不显示「已是最新」',
        async (fail) => {
            const harness = createHarness({ config: defaultConfig({ check: { fail } }) })
            const status = await harness.core.check({ manual: true })
            expect(status.state).toBe('failed')
            expect(status.failure).toEqual({ stage: 'check', reason: fail })
            expect(status.updateAvailable).toBe(false)
            expect(harness.realChecker.check).not.toHaveBeenCalled()
        }
    )

    it.each([
        ['offline', 'download', 'offline'],
        ['timeout', 'download', 'timeout'],
        ['server', 'download', 'server'],
        ['verify', 'verify', 'unknown']
    ] as const)(
        'failed：download.fail = %s ⇒ failed(%s, %s)，且不进「待重启」',
        async (fail, stage, reason) => {
            const harness = createHarness({
                config: defaultConfig({ download: { fail, steps: 3, intervalMs: 10 } })
            })
            expect((await harness.core.check({ manual: true })).state).toBe('available')
            const status = await harness.core.download()
            expect(status.state).toBe('failed')
            expect(status.failure).toEqual({ stage, reason })
            // AC5：失败不得留下「已下载待重启」
            expect(harness.store.readCheck()?.readyVersion).toBeUndefined()
        }
    )

    it('校验失败可以重试（失败态 ⇒ 再点下载仍走假源，不是死路）', async () => {
        const harness = createHarness({
            config: defaultConfig({ download: { fail: 'verify', steps: 2, intervalMs: 5 } })
        })
        await harness.core.check({ manual: true })
        expect((await harness.core.download()).state).toBe('failed')
        // 改成成功的配置再重试 ⇒ 直达 ready（AC5 的「可重试」）
        harness.setConfig(defaultConfig({ download: { steps: 2, intervalMs: 5 } }))
        const retried = await harness.core.download()
        expect(retried.state).toBe('ready')
    })

    it('downloading → ready：进度按配置推进（可快可慢），终态 100%', async () => {
        const harness = createHarness({
            config: defaultConfig({ download: { steps: 4, intervalMs: 250 } })
        })
        await harness.core.check({ manual: true })
        const status = await harness.core.download()

        expect(status.state).toBe('ready')
        expect(status.percent).toBe(100)
        expect(status.downloadedBytes).toBe(SIZE_BYTES)
        expect(status.totalBytes).toBe(SIZE_BYTES)
        // 进度档位单调推进（25 → 50 → 75 → 100）
        const percents = harness.statuses
            .filter((item) => item.state === 'downloading')
            .map((item) => item.percent)
            .filter((percent): percent is number => typeof percent === 'number')
        expect(percents).toEqual([25, 50, 75, 100])
        // 「可快可慢」= 每个档位都用配置里的间隔（注入定时器 ⇒ 不真等）
        expect(harness.delays).toEqual([250, 250, 250, 250])
    })

    it('进度档数与间隔缺省时用默认值（不真等）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        expect((await harness.core.download()).state).toBe('ready')
        expect(harness.delays).toHaveLength(FAKE_FEED_DEFAULT_STEPS)
        expect(new Set(harness.delays)).toEqual(new Set([FAKE_FEED_DEFAULT_INTERVAL_MS]))
    })

    it('just-updated：假安装不退出、不替换，重建内核后即为「已更新」', async () => {
        const harness = createHarness({
            config: defaultConfig({ download: { steps: 2, intervalMs: 5 } })
        })
        await harness.core.check({ manual: true })
        expect((await harness.core.download()).state).toBe('ready')

        const outcome = await harness.core.install()
        expect(outcome).toEqual({ installed: true })
        // 假安装只改内存：生产安装器零调用（不真替换、不真退出）
        expect(harness.realInstaller.install).not.toHaveBeenCalled()
        // 内核状态机零改动 ⇒ `ready` 不会自己变成 just-updated
        expect(harness.core.getStatus().state).toBe('ready')

        // index 的「假安装后重建」同一路径：同端口 + 同缓存
        const rebuilt = harness.rebuild()
        const status = rebuilt.getStatus()
        expect(status.state).toBe('just-updated')
        expect(status.currentVersion).toBe(FAKE_VERSION)
        expect(status.latestVersion).toBe(FAKE_VERSION)
        // 已消费标记：再重建一次不会重复报「刚更新」
        expect(harness.store.readCheck()?.readyVersion).toBeUndefined()
        expect(harness.rebuild().getStatus().state).toBe('up-to-date')
    })

    it('连续走查：改配置文件即切换场景，无需重启 Electron', async () => {
        const harness = createHarness()
        expect((await harness.core.check({ manual: true })).state).toBe('available')
        harness.setConfig(defaultConfig({ check: { fail: 'offline' } }))
        expect((await harness.core.check({ manual: true })).failure).toEqual({
            stage: 'check',
            reason: 'offline'
        })
        harness.setConfig(defaultConfig({ check: { fail: 'timeout' } }))
        expect((await harness.core.check({ manual: true })).failure).toEqual({
            stage: 'check',
            reason: 'timeout'
        })
    })

    it('配置里的失败原因在假源里等价于内核认得的错误码（收窄口径一致）', () => {
        // 假源只借「网络栈错误码 / HTTP 状态 / 校验错误名」三类特征，⛔ 不新造分类
        expect(classifyFailure(Object.assign(new Error('x'), { code: 'ENOTFOUND' }))).toBe(
            'offline'
        )
        expect(classifyFailure(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe(
            'timeout'
        )
        expect(classifyFailure(Object.assign(new Error('x'), { statusCode: 503 }))).toBe('server')
    })
})

describe('静态守卫：假源模块自身不碰 electron / electron-updater', () => {
    const source = (): string =>
        readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), '..', 'dev-fake-feed.ts'),
            'utf8'
        )
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^[ \t]*\/\/.*$/gm, '')

    it('不含 electron 模块说明符（isPackaged 由装配方传入）', () => {
        expect(/['"]electron['"]/.test(source())).toBe(false)
    })

    it('不含 electron-updater 模块说明符（假源零网络）', () => {
        expect(/['"]electron-updater['"]/.test(source())).toBe(false)
    })

    it('不引 node:net / node:http（不真联网）', () => {
        expect(/\bfrom\s+['"]node:(net|http|https|dgram)['"]/.test(source())).toBe(false)
    })
})