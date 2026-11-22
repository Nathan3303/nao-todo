// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import { loadImpl } from './impl-seam'

/**
 * T737 · 桌面端 `useDesktopUpdater` 真实现（preload 窄桥装配）
 *
 * @description 覆盖：单状态机订阅（订阅即回放）· 三个 invoke 动作（检查 / 下载 / 重启安装）·
 *              打开下载页 · 桥缺失时的降级（`isDesktop:false` + 全 no-op）·
 *              侧栏弱提示判据（`updateAvailable` 且该版本未在设置看过，设备级持久化）。
 *              性质断言而非实现细节：动作只证明「经桥调用一次」，失败只证明「状态不被伪造」。
 * @see packages/shared/types/desktop-update.ts（唯一契约）
 * @see docs/designs/358-desktop-self-update.md（§5 八态 · §9 测试钩子）
 */

const hoisted = vi.hoisted(() => ({ bridge: { current: null as unknown } }))

vi.mock('../../desktop-bridge', () => ({ getDesktopBridge: () => hoisted.bridge.current }))

const MODULE = '../use-desktop-updater.ts'
const MODULE_PATH = 'apps/desktop/src/renderer/src/hooks/use-desktop-updater.ts'
const LAST_SEEN_KEY = 'nao.lastSeenUpdateVersion'

interface HookModule {
    useDesktopUpdater: () => {
        isDesktop: boolean
        status: { value: DesktopUpdateStatus }
        loaded: { value: boolean }
        hintVisible: { value: boolean }
        check(): Promise<void>
        download(): Promise<void>
        restartToInstall(force?: boolean): Promise<void>
        openDownloadPage(): void
        markSeen(): void
    }
}

const loadHook = async (): Promise<HookModule> => {
    vi.resetModules()
    return loadImpl<HookModule>(MODULE, MODULE_PATH, ['useDesktopUpdater'], 'T737')
}

const baseStatus = (patch: Partial<DesktopUpdateStatus> = {}): DesktopUpdateStatus => ({
    state: 'idle',
    currentVersion: '1.20.3',
    installMode: 'in-place',
    updateAvailable: false,
    ...patch
})

type FakeBridge = {
    bridge: Record<string, unknown>
    update: {
        getStatus: ReturnType<typeof vi.fn>
        check: ReturnType<typeof vi.fn>
        download: ReturnType<typeof vi.fn>
        restartToInstall: ReturnType<typeof vi.fn>
        openDownloadPage: ReturnType<typeof vi.fn>
        onStatus: ReturnType<typeof vi.fn>
    }
    push(status: DesktopUpdateStatus): void
    subscribed(): boolean
}

const makeBridge = (options: { withUpdate?: boolean } = {}): FakeBridge => {
    let listener: ((status: DesktopUpdateStatus) => void) | null = null
    const update = {
        getStatus: vi.fn(async () => baseStatus()),
        check: vi.fn(async () => baseStatus({ state: 'checking' })),
        download: vi.fn(async () => baseStatus({ state: 'downloading', percent: 1 })),
        restartToInstall: vi.fn(async () => undefined),
        openDownloadPage: vi.fn(async () => undefined),
        onStatus: vi.fn((callback: (status: DesktopUpdateStatus) => void) => {
            listener = callback
            // 契约：订阅时立即回放当前状态
            callback(baseStatus())
            return () => {
                listener = null
            }
        })
    }
    const bridge: Record<string, unknown> = {
        isDesktop: true,
        platform: 'linux',
        versions: { electron: '31', chrome: '120', node: '20' },
        getShellStatus: async () => ({ tray: 'available', autostart: 'enabled' }),
        setAutostart: async () => ({ autostart: 'enabled' }),
        showMainWindow: async () => undefined,
        quit: async () => undefined,
        onPowerResume: () => () => undefined
    }
    if (options.withUpdate !== false) bridge.update = update
    return {
        bridge,
        update,
        push: (status) => listener?.(status),
        subscribed: () => listener !== null
    }
}

beforeEach(() => {
    hoisted.bridge.current = null
    localStorage.removeItem(LAST_SEEN_KEY)
})

afterEach(() => {
    hoisted.bridge.current = null
    localStorage.removeItem(LAST_SEEN_KEY)
})

describe('T737 · 装配与订阅（单状态机 + 订阅即回放）', () => {
    it('有 update 通道 ⇒ isDesktop:true，订阅即取到首份状态（无需额外拉取）', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()

        const updater = useDesktopUpdater()
        expect(updater.isDesktop).toBe(true)
        expect(fake.update.onStatus).toHaveBeenCalledTimes(1)
        expect(updater.status.value.state).toBe('idle')
        expect(updater.status.value.currentVersion).toBe('1.20.3')
    })

    it('主进程推播 ⇒ 渲染层状态跟随（同一份载荷，不做二次推导）', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        fake.push(
            baseStatus({ state: 'available', latestVersion: '1.21.0', updateAvailable: true })
        )
        expect(updater.status.value.state).toBe('available')
        expect(updater.status.value.latestVersion).toBe('1.21.0')
        expect(updater.loaded.value).toBe(true)
    })

    it('多消费方（设置面板 + 侧栏齿轮）共享同一份载荷，只订阅一次', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()

        const a = useDesktopUpdater()
        const b = useDesktopUpdater()
        fake.push(baseStatus({ state: 'ready', latestVersion: '1.21.0', updateAvailable: true }))

        expect(fake.update.onStatus).toHaveBeenCalledTimes(1)
        expect(a.status.value.state).toBe('ready')
        expect(b.status.value.state).toBe('ready')
    })

    it('无桥 / 旧 preload 无 update 命名空间 ⇒ isDesktop:false 且全 no-op（不抛）', async () => {
        const fake = makeBridge({ withUpdate: false })
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        expect(updater.isDesktop).toBe(false)
        expect(updater.hintVisible.value).toBe(false)
        await expect(updater.check()).resolves.toBeUndefined()
        await expect(updater.download()).resolves.toBeUndefined()
        await expect(updater.restartToInstall()).resolves.toBeUndefined()
        updater.openDownloadPage()
        updater.markSeen()
    })
})

describe('T737 · 动作经桥转发（AC2 / AC4 / AC7）', () => {
    it('检查 / 下载 / 重启安装各调桥一次，并采纳返回状态', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        await updater.check()
        expect(fake.update.check).toHaveBeenCalledTimes(1)
        expect(updater.status.value.state).toBe('checking')

        await updater.download()
        expect(fake.update.download).toHaveBeenCalledTimes(1)
        expect(updater.status.value.state).toBe('downloading')

        await updater.restartToInstall()
        expect(fake.update.restartToInstall).toHaveBeenCalledTimes(1)
        // 普通路径不带载荷（主进程按自己的就绪判定执行）
        expect(fake.update.restartToInstall).toHaveBeenCalledWith(undefined)
    })

    it('卡 A「仍要更新」二次确认 ⇒ 安装载荷带 force:true（AC9）', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        await updater.restartToInstall(true)
        expect(fake.update.restartToInstall).toHaveBeenCalledWith({ force: true })
    })

    it('打开下载页 ⇒ 走主进程系统浏览器（不开新窗口）', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        updater.openDownloadPage()
        await Promise.resolve()
        expect(fake.update.openDownloadPage).toHaveBeenCalledTimes(1)
    })

    it('桥调用抛错 ⇒ 保留上一份状态，不伪造 failed', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        fake.push(baseStatus({ state: 'up-to-date', updateAvailable: false }))
        fake.update.check.mockRejectedValueOnce(new Error('ipc gone'))
        await updater.check()

        expect(updater.status.value.state).toBe('up-to-date')
    })
})

describe('T737 · 侧栏弱提示判据（有可用更新且该版本未在设置看过）', () => {
    const available = (version: string): DesktopUpdateStatus =>
        baseStatus({ state: 'available', latestVersion: version, updateAvailable: true })

    it('available 且未看过 ⇒ hintVisible:true；markSeen 后即消并落设备级存储', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        fake.push(available('1.21.0'))
        expect(updater.hintVisible.value).toBe(true)

        updater.markSeen()
        expect(updater.hintVisible.value).toBe(false)
        expect(localStorage.getItem(LAST_SEEN_KEY)).toBe('1.21.0')
    })

    it('看过 1.21.0 后又出现 1.22.0 ⇒ 弱提示重新亮（版本变了）', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        fake.push(available('1.21.0'))
        updater.markSeen()
        expect(updater.hintVisible.value).toBe(false)

        fake.push(available('1.22.0'))
        expect(updater.hintVisible.value).toBe(true)
    })

    it('设备级标记跨会话生效（新会话读到上次已看过的版本 ⇒ 不亮）', async () => {
        localStorage.setItem(LAST_SEEN_KEY, '1.21.0')
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        fake.push(available('1.21.0'))
        expect(updater.hintVisible.value).toBe(false)
    })

    it('无可用更新（idle / up-to-date）⇒ 不亮', async () => {
        const fake = makeBridge()
        hoisted.bridge.current = fake.bridge
        const { useDesktopUpdater } = await loadHook()
        const updater = useDesktopUpdater()

        fake.push(baseStatus({ state: 'up-to-date', latestVersion: undefined }))
        expect(updater.hintVisible.value).toBe(false)
    })
})