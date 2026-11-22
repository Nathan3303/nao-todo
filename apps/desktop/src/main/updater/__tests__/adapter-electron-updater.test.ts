// @vitest-environment node
import { describe, expect, it, vi } from 'vite-plus/test'
import type { UpdaterDownloadOutcome, UpdaterProgress } from '../core'
import {
    createElectronUpdaterPorts,
    type ElectronUpdaterLike,
    UPDATE_CHECK_TIMEOUT_MS,
    UPDATE_DOWNLOAD_PAGE_URL,
    UPDATE_PROGRESS_INTERVAL_MS,
    UpdateCheckTimeoutError
} from '../adapters/electron-updater'

/**
 * T740 · `electron-updater` adapter（DEF-03 / DEF-04）
 *
 * @description 本文件是**唯一**允许接触 adapter 的单测（它同时是唯一接触 `electron-updater`
 *              的实现文件）。两条隔离硬规矩：
 *              ① `electron`（`app` / `shell`）全程 `vi.mock` —— 不加载真实主进程模块；
 *              ② `electron-updater` 经 `node:module` 的 `createRequire` 惰性加载，
 *                 用例把它替换成**计数 + 可注入失败**的假 loader ⇒ **零真实网络**。
 *              覆盖面：下载失败原因码分类（DEF-03）· 检查超时 abort · sha512 校验失败 ·
 *              进度节流 · 取消/中断 · `install` 调用参数 · 惰性加载失败不外抛（DEF-04 ①–⑦）。
 * @see docs/adr/2026-11-20-desktop-self-update.md（可测性前置 ①② / 启动不阻断）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC5 / §六 性能）
 */

/** require 闸 / electron 桩（`vi.mock` 工厂要用 ⇒ 必须 hoisted） */
const gate = vi.hoisted(() => ({
    /** `requireFromMain('electron-updater')` 调用次数（证明「构造期才加载」） */
    loads: 0,
    /** `true` ⇒ 模拟依赖缺失（`require` 抛错，DEF-04 ⑦） */
    failLoad: false,
    /** 系统浏览器（`shell.openExternal`） */
    openExternal: vi.fn(async (_url: string) => {})
}))

vi.mock('electron', () => ({
    app: { isPackaged: true, getVersion: () => '1.20.3' },
    shell: { openExternal: (url: string) => gate.openExternal(url) }
}))

vi.mock('node:module', () => ({
    createRequire: () => (specifier: string) => {
        if (specifier !== 'electron-updater') throw new Error(`unexpected require: ${specifier}`)
        gate.loads += 1
        if (gate.failLoad) {
            const error = new Error("Cannot find module 'electron-updater'") as Error & {
                code?: string
            }
            error.code = 'MODULE_NOT_FOUND'
            throw error
        }
        // 缺省路径用例仍需一个假实例（真实 autoUpdater 永不加载）
        return { autoUpdater: createFakeUpdater() }
    }
}))

type Listener = (...args: unknown[]) => void

/**
 * 假实例：`ElectronUpdaterLike`（能直接注入 adapter）+ `vi.fn` 方法（能断调用数）+ 测试专属方法
 * @description 用交叉类型而不是 `interface extends`：`vi.fn` 的 Mock 形态与接口方法的
 *              「可选参数」声明不完全兼容，`extends` 会报 TS2430。
 */
type FakeUpdater = ElectronUpdaterLike & {
    checkForUpdates: ReturnType<typeof vi.fn>
    downloadUpdate: ReturnType<typeof vi.fn>
    quitAndInstall: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    off: ReturnType<typeof vi.fn>
    /** 推一个事件（模拟 `electron-updater` 的事件源） */
    emit(event: string, payload?: unknown): void
    /** 当前监听器个数（断言「下载结束已解绑」） */
    listenerCount(event: string): number
}

/** 假 `electron-updater` 实例（事件语义与真实包一致：`on` / `off` 成对） */
const createFakeUpdater = (): FakeUpdater => {
    const listeners = new Map<string, Set<Listener>>()
    const fake: FakeUpdater = {
        // 真实包默认 `true`：adapter 必须在构造时压成 `false`（ADR 决策）
        autoDownload: true,
        autoInstallOnAppQuit: true,
        checkForUpdates: vi.fn(async () => ({ updateInfo: { version: '1.21.0' } })),
        downloadUpdate: vi.fn(async () => undefined),
        // 记录调用参数（`(false, true)` = 静默关、装完拉起）
        quitAndInstall: vi.fn((..._args: unknown[]): void => {}),
        on: vi.fn((event: string, listener: Listener) => {
            const set = listeners.get(event) ?? new Set<Listener>()
            set.add(listener)
            listeners.set(event, set)
            return fake
        }),
        off: vi.fn((event: string, listener: Listener) => {
            listeners.get(event)?.delete(listener)
            return fake
        }),
        emit: (event, payload) => {
            // 快照：回调里可能解绑自己（`off`），不能在活集合上边遍历边删
            const set = listeners.get(event)
            if (!set) return
            for (const listener of Array.from(set)) listener(payload)
        },
        listenerCount: (event) => (listeners.get(event) ?? new Set<Listener>()).size
    }
    return fake
}

/** 手动可控的 Promise（测「超时后底层请求才回来」的收尾） */
const createDeferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
        resolve = res
    })
    return { promise, resolve }
}

describe('惰性加载（ADR 启动不阻断）', () => {
    it('模块顶层 import 完成后仍 0 次 require ⇒ 依赖缺失不会打断模块加载', () => {
        // 本文件顶部已 static import adapter；若恢复成顶层 import 依赖，这里立刻变红
        expect(gate.loads).toBe(0)
    })

    it('构造端口时才 require，且只 1 次（默认路径）', () => {
        const before = gate.loads
        const ports = createElectronUpdaterPorts()
        expect(gate.loads - before).toBe(1)
        expect(Object.keys(ports).sort()).toEqual(['checker', 'downloader', 'env', 'installer'])
    })

    it('require 抛错 ⇒ 只在构造处抛（启动链路 try/catch 能兜住，不外抛到窗口创建）', () => {
        gate.failLoad = true
        try {
            expect(() => createElectronUpdaterPorts()).toThrow(/Cannot find module/)
            // main/index.ts 的 setupUpdater 形态：兜住 ⇒ handle 为 null，进程继续
            const setupUpdater = (): unknown => {
                try {
                    return createElectronUpdaterPorts()
                } catch {
                    return null
                }
            }
            expect(setupUpdater()).toBeNull()
        } finally {
            gate.failLoad = false
        }
        // 还原后仍可正常装配（失败不是永久降级）
        expect(createElectronUpdaterPorts().checker).toBeDefined()
    })
})

describe('构造契约：autoDownload / autoInstallOnAppQuit 强制关闭', () => {
    it('假实例初值 true ⇒ 构造后均为 false（下载与安装只能用户显式触发）', () => {
        const updater = createFakeUpdater()
        expect([updater.autoDownload, updater.autoInstallOnAppQuit]).toEqual([true, true])

        createElectronUpdaterPorts({ updater })

        expect([updater.autoDownload, updater.autoInstallOnAppQuit]).toEqual([false, false])
        expect(updater.quitAndInstall).toHaveBeenCalledTimes(0)
    })

    it('实例只读（写入抛错）⇒ 构造不中断（极端环境不得让更新器整体不可用）', () => {
        const updater = createFakeUpdater()
        Object.defineProperty(updater, 'autoDownload', {
            get: () => true,
            set: () => {
                throw new Error('readonly')
            }
        })
        expect(() => createElectronUpdaterPorts({ updater })).not.toThrow()
    })
})

describe('检查端口（AC1 / NFR ≤10s 超时）', () => {
    it('成功 ⇒ 版本 + 当前平台产物体积（path 命中优先）', async () => {
        const updater = createFakeUpdater()
        updater.checkForUpdates.mockResolvedValue({
            updateInfo: {
                version: '1.21.0',
                path: 'nao-todo-1.21.0.AppImage',
                files: [
                    { url: 'nao-todo-1.21.0.exe', size: 1 },
                    { url: 'nao-todo-1.21.0.AppImage', size: 125_829_120 }
                ]
            }
        })
        const ports = createElectronUpdaterPorts({ updater })

        expect(await ports.checker.check()).toEqual({
            version: '1.21.0',
            sizeBytes: 125_829_120
        })
        expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    })

    it('体积缺失/为 0 ⇒ 不给数字（⛔ 不编 0）', async () => {
        const updater = createFakeUpdater()
        updater.checkForUpdates.mockResolvedValue({
            updateInfo: { version: '1.21.0', files: [{ url: 'a.exe', size: 0 }] }
        })
        const ports = createElectronUpdaterPorts({ updater })

        expect(await ports.checker.check()).toEqual({
            version: '1.21.0',
            sizeBytes: undefined
        })
    })

    it('超时 ⇒ reject 可辨识错误，且底层请求晚到时取消它（cancel 恰好 1 次）', async () => {
        const updater = createFakeUpdater()
        const token = { cancel: vi.fn() }
        const deferred = createDeferred<{
            updateInfo: { version: string }
            cancellationToken: { cancel(): void }
        }>()
        updater.checkForUpdates.mockReturnValue(deferred.promise)
        const ports = createElectronUpdaterPorts({ updater, timeoutMs: 20 })

        await expect(ports.checker.check()).rejects.toBeInstanceOf(UpdateCheckTimeoutError)
        expect(token.cancel).toHaveBeenCalledTimes(0)

        // 逾期后才回来的检查：取消底层请求（不留后台请求）
        deferred.resolve({ updateInfo: { version: '1.21.0' }, cancellationToken: token })
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(token.cancel).toHaveBeenCalledTimes(1)
    })

    it('默认超时 = 10s（NFR 常量），检查响应无版本 ⇒ reject（不把空版本当更新）', async () => {
        expect(UPDATE_CHECK_TIMEOUT_MS).toBe(10_000)
        const updater = createFakeUpdater()
        updater.checkForUpdates.mockResolvedValue(null)
        const ports = createElectronUpdaterPorts({ updater })

        await expect(ports.checker.check()).rejects.toThrow('update check returned no version')
    })
})

describe('下载失败 ⇒ 阶段 + 原因码（DEF-03）', () => {
    const cases: [string, unknown, UpdaterDownloadOutcome][] = [
        [
            '离线（ENOTFOUND）',
            Object.assign(new Error('getaddrinfo ENOTFOUND github.com'), { code: 'ENOTFOUND' }),
            { ok: false, stage: 'download', reason: 'offline' }
        ],
        [
            '离线（ERR_INTERNET_DISCONNECTED）',
            new Error('net::ERR_INTERNET_DISCONNECTED'),
            { ok: false, stage: 'download', reason: 'offline' }
        ],
        [
            '超时（ETIMEDOUT）',
            Object.assign(new Error('connect ETIMEDOUT 140.82.121.4:443'), { code: 'ETIMEDOUT' }),
            { ok: false, stage: 'download', reason: 'timeout' }
        ],
        [
            '超时（Chromium net::ERR_TIMED_OUT）',
            new Error('net::ERR_TIMED_OUT'),
            { ok: false, stage: 'download', reason: 'timeout' }
        ],
        [
            '服务不可用（503）',
            Object.assign(new Error('update server error'), { statusCode: 503 }),
            { ok: false, stage: 'download', reason: 'server' }
        ],
        [
            '服务不可用（404 Not Found）',
            new Error('HttpError: 404 Not Found'),
            { ok: false, stage: 'download', reason: 'server' }
        ],
        [
            '磁盘不足（ENOSPC）',
            Object.assign(new Error('write failed'), { code: 'ENOSPC' }),
            { ok: false, stage: 'download', reason: 'disk' }
        ],
        [
            '认不出 ⇒ unknown（文案仍是「可以再试一次」）',
            new Error('莫名其妙'),
            {
                ok: false,
                stage: 'download',
                reason: 'unknown'
            }
        ],
        [
            '校验未过 ⇒ stage=verify（AC5：不得进待重启）',
            new Error('sha512 checksum mismatch'),
            {
                ok: false,
                stage: 'verify',
                reason: 'unknown'
            }
        ]
    ]

    it.each(cases)('%s', async (_label, error, expected) => {
        const updater = createFakeUpdater()
        updater.downloadUpdate.mockRejectedValue(error)
        const ports = createElectronUpdaterPorts({ updater })

        expect(await ports.downloader.download({ onProgress: () => {} })).toEqual(expected)
        expect(updater.quitAndInstall).toHaveBeenCalledTimes(0)
    })

    it('reject 的不是 Error（字符串/undefined）⇒ 不抛给调用方，落 download/unknown', async () => {
        const updater = createFakeUpdater()
        updater.downloadUpdate.mockRejectedValue('boom')
        const ports = createElectronUpdaterPorts({ updater })

        expect(await ports.downloader.download({ onProgress: () => {} })).toEqual({
            ok: false,
            stage: 'download',
            reason: 'unknown'
        })
    })

    it('成功 ⇒ ok:true 且解绑进度监听（不留悬挂监听）', async () => {
        const updater = createFakeUpdater()
        const ports = createElectronUpdaterPorts({ updater })

        expect(await ports.downloader.download({ onProgress: () => {} })).toEqual({ ok: true })
        expect(updater.on).toHaveBeenCalledWith('download-progress', expect.any(Function))
        expect(updater.off).toHaveBeenCalledTimes(1)
        expect(updater.listenerCount('download-progress')).toBe(0)
    })
})

describe('进度回调节流（设计稿 §7 ≤2 次/秒）', () => {
    /** 按给定时刻推 ticks（同一假实例，时钟用 `Date.now` 桩） */
    const runTicks = async (
        ticks: { at: number; payload: Record<string, number> }[],
        progressIntervalMs?: number
    ): Promise<UpdaterProgress[]> => {
        const updater = createFakeUpdater()
        let clock = 0
        const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock)
        const collected: UpdaterProgress[] = []
        try {
            updater.downloadUpdate.mockImplementation(async () => {
                for (const tick of ticks) {
                    clock = tick.at
                    updater.emit('download-progress', tick.payload)
                }
                return undefined
            })
            const ports = createElectronUpdaterPorts(
                progressIntervalMs === undefined ? { updater } : { updater, progressIntervalMs }
            )
            await ports.downloader.download({ onProgress: (progress) => collected.push(progress) })
            return collected
        } finally {
            spy.mockRestore()
        }
    }

    const ticks = [
        { at: 10_000, payload: { transferred: 10, total: 100, percent: 10 } },
        { at: 10_100, payload: { transferred: 20, total: 100, percent: 20 } },
        { at: 10_200, payload: { transferred: 30, total: 100, percent: 30 } },
        { at: 10_600, payload: { transferred: 80, total: 100, percent: 80 } },
        { at: 10_650, payload: { transferred: 100, total: 100, percent: 100 } }
    ]

    it('默认 500ms：5 个 tick 只推 3 次，且末态 100% 立即推（不被节流吞掉）', async () => {
        expect(UPDATE_PROGRESS_INTERVAL_MS).toBe(500)

        const pushed = await runTicks(ticks)

        expect(pushed.map((progress) => progress.percent)).toEqual([10, 80, 100])
    })

    it('对照：间隔 0（关节流）⇒ 5 个 tick 全推 ⇒ 少推确实来自节流而非丢事件', async () => {
        const pushed = await runTicks(ticks, 0)

        expect(pushed.map((progress) => progress.percent)).toEqual([10, 20, 30, 80, 100])
    })

    it('归一：无总量 ⇒ 只给已下载字节不给百分比；百分比取整并夹在 0–100', async () => {
        const pushed = await runTicks(
            [
                { at: 1_000, payload: { transferred: 1_536 } },
                { at: 2_000, payload: { transferred: 50, total: 0, percent: 50 } },
                { at: 3_000, payload: { transferred: 99, total: 100, percent: 99.6 } },
                { at: 4_000, payload: { transferred: 100, total: 100, percent: 140 } }
            ],
            0
        )

        expect(pushed).toEqual([
            { downloadedBytes: 1_536, totalBytes: undefined, percent: undefined },
            // total 为 0 视为未知 ⇒ 不给百分比（不显示 0 MB / 0%）
            { downloadedBytes: 50, totalBytes: undefined, percent: undefined },
            { downloadedBytes: 99, totalBytes: 100, percent: 100 },
            { downloadedBytes: 100, totalBytes: 100, percent: 100 }
        ])
    })

    it('订阅侧抛错 ⇒ 下载不中断（进度回调不是控制流）', async () => {
        const updater = createFakeUpdater()
        updater.downloadUpdate.mockImplementation(async () => {
            updater.emit('download-progress', { transferred: 1, total: 2, percent: 50 })
            return undefined
        })
        const ports = createElectronUpdaterPorts({ updater, progressIntervalMs: 0 })
        let calls = 0

        const outcome = await ports.downloader.download({
            onProgress: () => {
                calls += 1
                throw new Error('subscriber boom')
            }
        })

        expect(calls).toBe(1)
        expect(outcome).toEqual({ ok: true })
    })
})

describe('取消 / 中断', () => {
    it('下载中断（reject）⇒ 失败可重试，且进度监听已解绑、之后不再推', async () => {
        const updater = createFakeUpdater()
        updater.downloadUpdate.mockImplementation(async () => {
            updater.emit('download-progress', { transferred: 5, total: 10, percent: 50 })
            throw new Error('Download cancelled by user')
        })
        const ports = createElectronUpdaterPorts({ updater, progressIntervalMs: 0 })
        const collected: UpdaterProgress[] = []

        const outcome = await ports.downloader.download({
            onProgress: (progress) => collected.push(progress)
        })

        expect(outcome).toEqual({ ok: false, stage: 'download', reason: 'unknown' })
        expect(collected).toHaveLength(1)
        expect(updater.listenerCount('download-progress')).toBe(0)

        // 中断后事件源若再推（底层仍在跑），不得再进 UI
        updater.emit('download-progress', { transferred: 9, total: 10, percent: 90 })
        expect(collected).toHaveLength(1)
    })

    it('实例缺 `off`（只有 removeListener）⇒ 同样解绑，不留监听', async () => {
        const updater = createFakeUpdater()
        const removed: Listener[] = []
        updater.removeListener = vi.fn((_event: string, listener: Listener) => {
            removed.push(listener)
        })
        delete (updater as { off?: unknown }).off
        const ports = createElectronUpdaterPorts({ updater })

        await ports.downloader.download({ onProgress: () => {} })

        expect(removed).toHaveLength(1)
    })
})

describe('安装 / 环境端口', () => {
    it('install ⇒ quitAndInstall(false, true) 恰好 1 次（静默关、装完拉起）', async () => {
        const updater = createFakeUpdater()
        const ports = createElectronUpdaterPorts({ updater })

        await ports.installer.install()

        expect(updater.quitAndInstall).toHaveBeenCalledTimes(1)
        expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
        // 安装不得顺带触发下载（用户显式点了才装）
        expect(updater.downloadUpdate).toHaveBeenCalledTimes(0)
    })

    it('env 端口：版本/打包态取注入 app，平台取 process.platform，APPIMAGE 取注入 env', async () => {
        const updater = createFakeUpdater()
        const ports = createElectronUpdaterPorts({
            updater,
            app: { isPackaged: false, getVersion: () => '9.9.9' },
            env: { APPIMAGE: '/tmp/nao-todo.AppImage' }
        })

        expect(ports.env.currentVersion()).toBe('9.9.9')
        expect(ports.env.isPackaged).toBe(false)
        expect(ports.env.platform).toBe(process.platform)
        expect(ports.env.appimage).toBe('/tmp/nao-todo.AppImage')

        await ports.env.openDownloadPage()
        expect(gate.openExternal).toHaveBeenCalledWith(UPDATE_DOWNLOAD_PAGE_URL)
    })
})