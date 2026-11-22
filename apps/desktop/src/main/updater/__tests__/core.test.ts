import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import {
    classifyFailure,
    createUpdaterCore,
    type CreateUpdaterCoreOptions,
    type UpdaterCore
} from '../core'
import { createUpdateStore, UPDATE_CHECK_INTERVAL_MS, type UpdateStore } from '../store'

/**
 * T736 · 更新内核（AC1 / AC2 / AC4 / AC5 / AC6 / AC7 / AC8 / AC9 / AC11）
 *
 * @description 五端口（`checker` / `downloader` / `installer` / `env` / `syncGuard`）全部注入：
 *              **零网络、零 electron**，缓存用真 temp dir（可测性前置 ①②⑤）。
 *              「可观测代价」逐条给数：安装器调用数 0/1、检查请求数、进度回调序列、历史条数。
 */

const START = 1_700_000_000_000

interface Harness {
    core: UpdaterCore
    /** 五端口 + 缓存面（重启用例复用同一份端口与缓存） */
    ports: Omit<CreateUpdaterCoreOptions, 'now'>
    store: UpdateStore
    dir: string
    checker: { check: ReturnType<typeof vi.fn> }
    downloader: { download: ReturnType<typeof vi.fn> }
    installer: { install: ReturnType<typeof vi.fn> }
    syncGuard: { hasPendingChanges: ReturnType<typeof vi.fn> }
    openDownloadPage: ReturnType<typeof vi.fn>
    /** 本地日志摘要（AC9b：只能是脱敏后的原因码，⛔ 不含原文 / 路径） */
    logs: string[]
    statuses: DesktopUpdateStatus[]
    setNow: (at: number) => void
    advance: (ms: number) => void
    now: () => number
}

interface HarnessOptions {
    platform?: string
    appimage?: string | null
    isPackaged?: boolean
    currentVersion?: string
    pendingChanges?: boolean
}

const dirs: string[] = []

afterEach(() => {
    while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true })
})

const createHarness = (options: HarnessOptions = {}): Harness => {
    const dir = mkdtempSync(join(tmpdir(), 'nao-update-core-'))
    dirs.push(dir)
    const store = createUpdateStore(dir)
    let clock = START

    const checker = { check: vi.fn(async () => ({ version: '1.21.0', sizeBytes: 113_246_208 })) }
    const downloader = {
        download: vi.fn(
            async ({
                onProgress
            }: {
                onProgress: (progress: {
                    downloadedBytes?: number
                    totalBytes?: number
                    percent?: number
                }) => void
            }) => {
                onProgress({ downloadedBytes: 56_623_104, totalBytes: 113_246_208, percent: 50 })
                return { ok: true }
            }
        )
    }
    const installer = { install: vi.fn() }
    const syncGuard = { hasPendingChanges: vi.fn(() => options.pendingChanges ?? false) }
    const openDownloadPage = vi.fn()
    const logs: string[] = []

    const ports = {
        env: {
            currentVersion: () => options.currentVersion ?? '1.20.3',
            platform: options.platform ?? 'linux',
            appimage: options.appimage === undefined ? '/tmp/nao-todo.AppImage' : options.appimage,
            isPackaged: options.isPackaged ?? true,
            openDownloadPage
        },
        checker,
        downloader,
        installer,
        syncGuard,
        store,
        onError: (summary: string) => logs.push(summary)
    }
    const core = createUpdaterCore({ ...ports, now: () => clock })

    const statuses: DesktopUpdateStatus[] = []
    core.subscribe((status) => statuses.push(status))

    return {
        core,
        ports,
        store,
        dir,
        checker,
        downloader,
        installer,
        syncGuard,
        openDownloadPage,
        logs,
        statuses,
        setNow: (at) => {
            clock = at
        },
        advance: (ms) => {
            clock += ms
        },
        now: () => clock
    }
}

const lastState = (harness: Harness): string => harness.statuses.at(-1)?.state ?? 'none'

describe('检查更新（AC1 / AC6 / AC4 / AC11）', () => {
    it('AC1：远端更高 ⇒ available（版本 / 体积 / 模式齐备）', async () => {
        const harness = createHarness()
        expect(harness.core.getStatus().state).toBe('idle')

        const status = await harness.core.check({ manual: true })

        expect(status.state).toBe('available')
        expect(status.latestVersion).toBe('1.21.0')
        expect(status.sizeBytes).toBe(113_246_208)
        expect(status.installMode).toBe('in-place')
        expect(status.updateAvailable).toBe(true)
        expect(status.currentVersion).toBe('1.20.3')
        expect(status.lastCheckedAt).toBe(new Date(START).toISOString())
        expect(harness.checker.check).toHaveBeenCalledTimes(1)
        expect(harness.store.readCheck()).toMatchObject({
            lastCheckAt: START,
            latestVersion: '1.21.0',
            result: 'available'
        })
    })

    it('AC6：远端等于当前版本 ⇒ up-to-date，且不出现可用更新', async () => {
        const harness = createHarness()
        harness.checker.check.mockResolvedValue({ version: '1.20.3' })

        const status = await harness.core.check({ manual: true })

        expect(status.state).toBe('up-to-date')
        expect(status.updateAvailable).toBe(false)
        expect(harness.store.readCheck()?.result).toBe('up-to-date')
    })

    it('AC6：远端更旧 ⇒ 仍是 up-to-date（回滚重发不误报）', async () => {
        const harness = createHarness()
        harness.checker.check.mockResolvedValue({ version: '1.20.1' })
        expect((await harness.core.check({ manual: true })).state).toBe('up-to-date')
    })

    it('AC4：检查失败 ⇒ failed(check) + 请求计数 1，且从未出现「已是最新」', async () => {
        const harness = createHarness()
        harness.checker.check.mockRejectedValue(
            Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
        )

        const status = await harness.core.check({ manual: true })

        expect(status.state).toBe('failed')
        expect(status.failure).toEqual({ stage: 'check', reason: 'offline' })
        expect(status.updateAvailable).toBe(false)
        expect(harness.checker.check).toHaveBeenCalledTimes(1)
        expect(harness.statuses.map((item) => item.state)).not.toContain('up-to-date')
        // 失败不落盘（重启后仍显示上次成功结论或无结论）
        expect(harness.store.readCheck()).toBeNull()
    })

    it.each([
        {
            name: '域名解析失败（ENOTFOUND）',
            error: Object.assign(new Error('getaddrinfo ENOTFOUND github.com'), {
                code: 'ENOTFOUND'
            }),
            reason: 'offline'
        },
        {
            name: '更新源返错（HTTP 500）',
            error: Object.assign(new Error('HttpError: 500 Internal Server Error'), {
                statusCode: 500
            }),
            reason: 'server'
        },
        {
            name: '请求超时（ETIMEDOUT）',
            error: Object.assign(new Error('connect ETIMEDOUT 140.82.112.4:443'), {
                code: 'ETIMEDOUT'
            }),
            reason: 'timeout'
        }
    ])(
        'AC4：$name ⇒ failed(check)/$reason（请求计数 1，且从未出现「已是最新」）',
        async ({ error, reason }) => {
            const harness = createHarness()
            harness.checker.check.mockRejectedValue(error)

            const status = await harness.core.check({ manual: true })

            expect(status.state).toBe('failed')
            expect(status.failure).toEqual({ stage: 'check', reason })
            expect(status.updateAvailable).toBe(false)
            expect(harness.checker.check).toHaveBeenCalledTimes(1)
            expect(harness.statuses.map((item) => item.state)).not.toContain('up-to-date')
            expect(harness.store.readCheck()).toBeNull()
            // 失败态仍给「打开下载页」出口（AC4 的第三个动作）
            await harness.core.openDownloadPage()
            expect(harness.openDownloadPage).toHaveBeenCalledTimes(1)
        }
    )

    it('AC4 + AC11：失败后再次手动检查仍可触发（按钮不永久禁用）', async () => {
        const harness = createHarness()
        harness.checker.check.mockRejectedValueOnce(new Error('boom'))
        expect((await harness.core.check({ manual: true })).state).toBe('failed')

        expect((await harness.core.check({ manual: true })).state).toBe('available')
        expect(harness.checker.check).toHaveBeenCalledTimes(2)
    })

    it('检查中重复触发不收第二次请求（防连点）', async () => {
        const harness = createHarness()
        let release: (() => void) | undefined
        harness.checker.check.mockImplementation(
            () =>
                new Promise((resolve) => {
                    release = () => resolve({ version: '1.21.0' })
                })
        )
        const first = harness.core.check({ manual: true })
        expect(lastState(harness)).toBe('checking')
        const second = await harness.core.check({ manual: true })
        expect(second.state).toBe('checking')
        release?.()
        await first
        expect(harness.checker.check).toHaveBeenCalledTimes(1)
    })
})

describe('下载与安装（AC2 / AC5 / AC9）', () => {
    it('AC2：下载完成只进 ready，安装器调用数在用户点「立即重启更新」前恒为 0', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })

        const status = await harness.core.download()

        expect(status.state).toBe('ready')
        expect(status.percent).toBe(100)
        expect(harness.installer.install).toHaveBeenCalledTimes(0)
        expect(harness.store.readCheck()?.readyVersion).toBe('1.21.0')

        const outcome = await harness.core.install()
        expect(outcome).toEqual({ installed: true })
        expect(harness.installer.install).toHaveBeenCalledTimes(1)
    })

    it('AC2：ready 期重复点安装只调一次安装器（幂等）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        await harness.core.download()

        await harness.core.install()
        await harness.core.install()

        expect(harness.installer.install).toHaveBeenCalledTimes(1)
    })

    it('AC5：下载中断/校验失败 ⇒ failed(verify) 且不进入 ready（可重试）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        harness.downloader.download.mockResolvedValueOnce({ ok: false, stage: 'verify' })

        const failed = await harness.core.download()

        expect(failed.state).toBe('failed')
        expect(failed.failure).toEqual({ stage: 'verify', reason: 'unknown' })
        expect(harness.statuses.map((item) => item.state)).not.toContain('ready')
        expect(harness.store.readCheck()?.readyVersion).toBeUndefined()
        expect(harness.installer.install).toHaveBeenCalledTimes(0)

        // 重试：不必重新检查，直接从 failed 回到 downloading → ready
        const retried = await harness.core.download()
        expect(retried.state).toBe('ready')
        expect(harness.downloader.download).toHaveBeenCalledTimes(2)
    })

    it('AC5：下载中断（连接断）⇒ failed(download)/offline，不进 ready、安装器 0、可重试', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        harness.downloader.download.mockResolvedValueOnce({
            ok: false,
            stage: 'download',
            reason: 'offline'
        })

        const status = await harness.core.download()

        expect(status.state).toBe('failed')
        expect(status.failure).toEqual({ stage: 'download', reason: 'offline' })
        expect(harness.statuses.map((item) => item.state)).not.toContain('ready')
        expect(harness.store.readCheck()?.readyVersion).toBeUndefined()
        expect(harness.installer.install).toHaveBeenCalledTimes(0)

        expect((await harness.core.download()).state).toBe('ready')
        expect(harness.downloader.download).toHaveBeenCalledTimes(2)
    })

    it('AC5：下载器抛错 ⇒ failed(download) + 收窄后的原因', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        harness.downloader.download.mockRejectedValueOnce(new Error('socket hang up ETIMEDOUT'))

        const status = await harness.core.download()

        expect(status.state).toBe('failed')
        expect(status.failure).toEqual({ stage: 'download', reason: 'timeout' })
    })

    it('AC9：有未同步改动时不安装（安装器 0），已下载状态保留；确认后才装', async () => {
        const harness = createHarness({ pendingChanges: true })
        await harness.core.check({ manual: true })
        await harness.core.download()

        const blocked = await harness.core.install()
        expect(blocked).toEqual({ installed: false, blocked: 'pending-sync' })
        expect(harness.installer.install).toHaveBeenCalledTimes(0)
        expect(harness.core.getStatus().state).toBe('ready')
        expect(harness.store.readCheck()?.readyVersion).toBe('1.21.0')

        const forced = await harness.core.install({ force: true })
        expect(forced).toEqual({ installed: true })
        expect(harness.installer.install).toHaveBeenCalledTimes(1)
    })

    it('未进入 ready 时点安装 ⇒ 不调用安装器（blocked=not-ready）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        expect(await harness.core.install()).toEqual({ installed: false, blocked: 'not-ready' })
        expect(harness.installer.install).toHaveBeenCalledTimes(0)
    })

    it('安装器抛错 ⇒ 保持 ready（用户可重试）并落失败历史', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        await harness.core.download()
        harness.installer.install.mockImplementation(() => {
            throw new Error('NSIS exit code 1')
        })

        expect(await harness.core.install()).toEqual({ installed: false })
        expect(harness.core.getStatus().state).toBe('ready')
        expect(
            harness.store.readHistory().some((entry) => entry.kind === 'install' && !entry.ok)
        ).toBe(true)
    })

    it('下载进度经回调可观测（percent 序列 + 终态 ready）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        harness.downloader.download.mockImplementationOnce(
            async ({
                onProgress
            }: {
                onProgress: (progress: {
                    downloadedBytes?: number
                    totalBytes?: number
                    percent?: number
                }) => void
            }) => {
                onProgress({ downloadedBytes: 10, totalBytes: 100, percent: 10 })
                onProgress({ downloadedBytes: 60, totalBytes: 100, percent: 60 })
                onProgress({ downloadedBytes: 100, totalBytes: 100, percent: 100 })
                return { ok: true }
            }
        )

        await harness.core.download()

        const percents = harness.statuses
            .map((status) => status.percent)
            .filter((percent): percent is number => typeof percent === 'number')
        expect(percents).toEqual([10, 60, 100, 100])
        expect(lastState(harness)).toBe('ready')
    })

    it('总量未知 ⇒ 不下发 percent（⛔ 不编数字）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        harness.downloader.download.mockImplementationOnce(
            async ({
                onProgress
            }: {
                onProgress: (progress: {
                    downloadedBytes?: number
                    totalBytes?: number
                    percent?: number
                }) => void
            }) => {
                onProgress({ downloadedBytes: 4096 })
                return { ok: true }
            }
        )

        await harness.core.download()
        const downloading = harness.statuses.filter((status) => status.state === 'downloading')
        expect(downloading.some((status) => status.percent !== undefined)).toBe(false)
        expect(downloading.at(-1)?.downloadedBytes).toBe(4096)
    })
})

describe('24h 缓存与启动恢复（AC8）', () => {
    it('AC8：静默检查按 23:59:59.999 / 24:00:00.000 计请求数', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: false })
        expect(harness.checker.check).toHaveBeenCalledTimes(1)

        harness.advance(UPDATE_CHECK_INTERVAL_MS - 1)
        await harness.core.check({ manual: false })
        expect(harness.checker.check).toHaveBeenCalledTimes(1)

        harness.advance(1)
        await harness.core.check({ manual: false })
        expect(harness.checker.check).toHaveBeenCalledTimes(2)
    })

    it('AC8：手动检查忽略缓存（必发一次请求）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        await harness.core.check({ manual: true })
        expect(harness.checker.check).toHaveBeenCalledTimes(2)
    })

    it('AC8：重启后仍显示上次结果（不回到 idle，且不再请求）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        harness.advance(60_000)

        // 新内核 = 重启（同一份缓存目录与端口）
        const restarted = createUpdaterCore({ ...harness.ports, now: harness.now })

        const status = restarted.getStatus()
        expect(status.state).toBe('available')
        expect(status.latestVersion).toBe('1.21.0')
        expect(status.lastCheckedAt).toBe(new Date(START).toISOString())
        // 静默检查仍在 24h 窗口内 ⇒ 不再请求
        await restarted.check({ manual: false })
        expect(harness.checker.check).toHaveBeenCalledTimes(1)
    })

    it('已下载待重启 ⇒ 重启后回到 ready（「稍后」不清已下载）', async () => {
        const harness = createHarness()
        harness.store.writeCheck({
            lastCheckAt: START,
            latestVersion: '1.21.0',
            result: 'available'
        })
        harness.store.writeCheck({ readyVersion: '1.21.0' })

        const restarted = createUpdaterCore({ ...harness.ports, now: harness.now })

        expect(restarted.getStatus().state).toBe('ready')
        expect(restarted.getStatus().updateAvailable).toBe(true)
    })

    it('本次启动装好的新版本 ⇒ just-updated，且清掉待重启标记', () => {
        const harness = createHarness({ currentVersion: '1.21.0' })
        harness.store.writeCheck({
            lastCheckAt: START,
            latestVersion: '1.21.0',
            result: 'available'
        })
        harness.store.writeCheck({ readyVersion: '1.21.0' })

        const restarted = createUpdaterCore({
            ...harness.ports,
            env: { ...harness.ports.env, currentVersion: () => '1.21.0' },
            now: harness.now
        })

        expect(restarted.getStatus().state).toBe('just-updated')
        expect(restarted.getStatus().latestVersion).toBe('1.21.0')
        expect(restarted.getStatus().updateAvailable).toBe(false)
        expect(harness.store.readCheck()?.readyVersion).toBeUndefined()
    })

    it('ready 期检查被拒（P5：不覆盖已下载成果，0 请求）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        await harness.core.download()
        expect(harness.core.getStatus().state).toBe('ready')

        await harness.core.check({ manual: true })

        expect(harness.core.getStatus().state).toBe('ready')
        expect(harness.checker.check).toHaveBeenCalledTimes(1)
    })
})

describe('不支持应用内更新（AC4b 前置 gate · AC7）', () => {
    /**
     * AC4b 的核心判据：**`checker.check` 调用数 = 0**（⛔ 不是「失败后降级」）
     * @description 挂载即 `unsupported`（不经历 `idle`），手动检查不触网、态不变，
     *              且订阅序列里不得出现 `checking` / `available` / `failed` 任何一个。
     */
    it('macOS ⇒ 初始即 unsupported + mac 原因；检查 0 请求、态不变；下载器 0 次', async () => {
        const harness = createHarness({ platform: 'darwin', appimage: undefined })

        // 挂载即展示（不靠一次检查才得出态）
        expect(harness.core.getStatus().state).toBe('unsupported')
        expect(harness.core.getStatus().installMode).toBe('download-page')
        expect(harness.core.getStatus().degradedReason).toBe('mac')
        expect(harness.core.getStatus().updateAvailable).toBe(false)

        const checked = await harness.core.check({ manual: true })

        expect(checked.state).toBe('unsupported')
        expect(harness.checker.check).toHaveBeenCalledTimes(0)
        // 前置 gate：不参与 checking / available / failed 流转
        expect(harness.statuses.map((item) => item.state)).toEqual([])

        await harness.core.download()
        expect(harness.downloader.download).toHaveBeenCalledTimes(0)
        expect(harness.core.getStatus().state).toBe('unsupported')
    })

    it('Linux deb ⇒ unsupported + deb 原因；检查 0 请求；打开下载页走 env 端口', async () => {
        const harness = createHarness({ appimage: null })

        expect(harness.core.getStatus().state).toBe('unsupported')
        expect(harness.core.getStatus().installMode).toBe('download-page')
        expect(harness.core.getStatus().degradedReason).toBe('deb')

        await harness.core.check({ manual: true })
        expect(harness.checker.check).toHaveBeenCalledTimes(0)

        await harness.core.openDownloadPage()
        expect(harness.openDownloadPage).toHaveBeenCalledTimes(1)
    })

    it('未打包开发态（linux + !isPackaged）⇒ unsupported + dev（不再是 deb），检查 0 请求', async () => {
        const harness = createHarness({ appimage: null, isPackaged: false })

        expect(harness.core.getStatus().state).toBe('unsupported')
        expect(harness.core.getStatus().degradedReason).toBe('dev')

        // 静默检查（启动期）同样不得触网
        await harness.core.check({ manual: false })
        await harness.core.check({ manual: true })
        expect(harness.checker.check).toHaveBeenCalledTimes(0)
        expect(harness.core.getStatus().state).toBe('unsupported')
    })

    it('未知平台（形态判定不出）⇒ unsupported 且不给原因（渲染层走 manual.unknown 兜底）', async () => {
        const harness = createHarness({ platform: 'freebsd', appimage: undefined })

        expect(harness.core.getStatus().state).toBe('unsupported')
        expect(harness.core.getStatus().installMode).toBe('download-page')
        expect(harness.core.getStatus().degradedReason).toBeUndefined()
        expect('degradedReason' in harness.core.getStatus()).toBe(false)
    })

    it('unsupported 下安装器恒 0（blocked=not-ready，不会接上 ready 路径）', async () => {
        const harness = createHarness({ appimage: null })
        expect(await harness.core.install()).toEqual({ installed: false, blocked: 'not-ready' })
        expect(harness.installer.install).toHaveBeenCalledTimes(0)
    })

    it('原地形态（AppImage）不受 gate 影响：仍能正常检查到 available', async () => {
        const harness = createHarness()
        expect(harness.core.getStatus().state).toBe('idle')
        expect((await harness.core.check({ manual: true })).state).toBe('available')
        expect(harness.checker.check).toHaveBeenCalledTimes(1)
    })
})

describe('错误原文不外露（AC9b）', () => {
    /** 用户实报的原文（`electron-updater` 在未打包 AppImage 环境下抛出） */
    const RAW_APPIMAGE_MESSAGE =
        'APPIMAGE env is not defined, current application is not an AppImage'

    it('检查失败（原文 = APPIMAGE …）⇒ 载荷不含原文、原因码 unknown、日志只有原因码', async () => {
        const harness = createHarness()
        harness.checker.check.mockRejectedValue(new Error(RAW_APPIMAGE_MESSAGE))

        const status = await harness.core.check({ manual: true })

        // ① 状态载荷（IPC 推播 + 渲染层状态 + i18n 文案选择的数据源）不含原文
        expect(status.state).toBe('failed')
        expect(status.failure).toEqual({ stage: 'check', reason: 'unknown' })
        expect(JSON.stringify(status)).not.toContain('APPIMAGE')
        expect(JSON.stringify(harness.statuses)).not.toContain('APPIMAGE')
        expect(JSON.stringify(harness.store.readHistory())).not.toContain('APPIMAGE')
        expect(JSON.stringify(harness.store.readHistory())).not.toContain(tmpdir())

        // ② 本地日志：只允许脱敏摘要（固定原因码），不得含原文 / 本机路径
        expect(harness.logs).toHaveLength(1)
        expect(harness.logs[0]).toBe('[update] failure reason=unknown')
        expect(harness.logs.join('\n')).not.toContain('APPIMAGE')
        expect(harness.logs.join('\n')).not.toContain(tmpdir())
    })

    it('下载失败（原文带本机路径 / 主机名）⇒ 载荷与日志均不含原文', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        const raw = `ENOTFOUND registry.example.com at ${tmpdir()}/nao-todo.AppImage`
        harness.downloader.download.mockRejectedValueOnce(new Error(raw))

        const status = await harness.core.download()

        expect(status.state).toBe('failed')
        // 认得出的部分仍可收窄（offline），但原文与路径一律不出载荷
        expect(status.failure).toEqual({ stage: 'download', reason: 'offline' })
        expect(JSON.stringify(status)).not.toContain('registry.example.com')
        expect(JSON.stringify(status)).not.toContain(tmpdir())
        expect(harness.logs.join('\n')).not.toContain(tmpdir())
        expect(harness.logs.join('\n')).not.toContain('registry.example.com')
        expect(harness.logs.every((line) => /^\[update\] failure reason=\w+$/.test(line))).toBe(
            true
        )
    })

    it('失败的下载 port 返回（非抛错）也只得原因码（不携带 message）', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        harness.downloader.download.mockResolvedValueOnce({
            ok: false,
            stage: 'download',
            reason: 'unknown'
        })

        const status = await harness.core.download()

        expect(Object.keys(status.failure ?? {}).sort()).toEqual(['reason', 'stage'])
        expect(JSON.stringify(status)).not.toContain('APPIMAGE')
    })
})

describe('可观测（NFR）', () => {
    it('检查 / 下载 / 安装各落一条历史，且不含本机路径', async () => {
        const harness = createHarness()
        await harness.core.check({ manual: true })
        await harness.core.download()
        await harness.core.install()

        const history = harness.store.readHistory()
        expect(history.map((entry) => entry.kind)).toEqual(['check', 'download', 'install'])
        expect(history.every((entry) => entry.ok)).toBe(true)
        expect(JSON.stringify(history)).not.toContain(tmpdir())
    })

    it('失败原因收窄表（分类可测、不外泄内部错误）', () => {
        expect(classifyFailure(Object.assign(new Error('x'), { code: 'ENOSPC' }))).toBe('disk')
        expect(classifyFailure(new Error('getaddrinfo ENOTFOUND github.com'))).toBe('offline')
        expect(classifyFailure(new Error('ERR_INTERNET_DISCONNECTED'))).toBe('offline')
        expect(classifyFailure(new Error('request timed out'))).toBe('timeout')
        // 真实网络栈的超时码（`electron-updater` 底层是 Chromium/Node 错误码，DEF-03）
        expect(classifyFailure(new Error('net::ERR_TIMED_OUT'))).toBe('timeout')
        expect(classifyFailure(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe(
            'timeout'
        )
        expect(classifyFailure(Object.assign(new Error('server boom'), { statusCode: 503 }))).toBe(
            'server'
        )
        expect(classifyFailure(new Error('HttpError: 404 Not Found'))).toBe('server')
        expect(classifyFailure(new Error('莫名其妙'))).toBe('unknown')
        expect(classifyFailure(undefined)).toBe('unknown')
    })
})