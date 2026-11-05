// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * T655 · AC5 信号源独立复验（web = `visibilityState`；desktop = 外部 IPC 信号）
 *
 * @description 与 RD 的 `t654-ac5-web-visibility.test.ts` **断言角度不同**：
 *              ① 缺省（= web 装配值）⇒ `document.visibilityState` 真的驱动门控（隐藏零请求 / 显示立即拉）；
 *              ② `manageDocumentVisibility: false`（= **桌面**装配值，桥存在时）⇒ `document` 信号
 *                 **完全惰性**：隐藏后仍按 30s 周期跑 ⇒ 证明桌面轮询门控**不可能**由 `visibilityState`
 *                 驱动，唯一来源只能是主进程 IPC（IPC → `runtime.setVisible` 由
 *                 `apps/desktop/src/renderer/src/window-visibility.ts` 的用例证明）；
 *              ③ 外部可见性信号（`setVisible`，即 IPC 落地形态）⇒ 隐藏零请求、唤回立即拉一次；
 *              ④ AC10：`dispose()` 后监听/定时器/广播全部释放。
 *
 * @see docs/prds/2026-11-05-sync-perception-polling.md（R-10 / AC5 / AC10）
 * @see docs/reports/T655-qa-verification.md
 */

const mocks = vi.hoisted(() => ({
    pullAll: vi.fn(async () => okResult()),
    resumeBackfill: vi.fn(async () => okResult()),
    applyForeignPullComplete: vi.fn(),
    countDirty: vi.fn(async () => 0),
    getCurrentUserId: vi.fn((): string | null => 't655-user'),
    logStructured: vi.fn()
}))

function okResult(): {
    ok: boolean
    errors: string[]
    lastError: null
    phase: null
    credentialFailure: boolean
    pullExecuted: boolean
} {
    return {
        ok: true,
        errors: [],
        lastError: null,
        phase: null,
        credentialFailure: false,
        pullExecuted: true
    }
}

vi.mock('@nao-todo/infrastructure/src/persistence-sync/sync-service', () => ({
    syncService: {
        pullAll: mocks.pullAll,
        resumeBackfill: mocks.resumeBackfill,
        applyForeignPullComplete: mocks.applyForeignPullComplete
    }
}))
vi.mock('@nao-todo/infrastructure/src/persistence-sync/sync-tracker', () => ({
    syncTracker: { countDirty: mocks.countDirty }
}))
vi.mock('@nao-todo/infrastructure/src/persistence-local/session/local-session', () => ({
    localSession: { getCurrentUserId: mocks.getCurrentUserId }
}))
vi.mock('@nao-todo/infrastructure/src/observability/structured-log', () => ({
    logStructured: mocks.logStructured,
    STRUCTURED_LOG_EVENTS: {
        SYNC_AUTO_REFRESH_FAILED: 'sync.auto-refresh.failed',
        SYNC_AUTO_REFRESH_STOPPED: 'sync.auto-refresh.stopped',
        SYNC_AUTO_REFRESH_BROADCAST: 'sync.auto-refresh.broadcast-hit'
    }
}))

const { startSyncRefreshRuntime, stopSyncRefreshRuntime } = await import('../sync-refresh-runtime')

/** 假 `BroadcastChannel`（同步派发，便于断言广播订阅是否真的释放） */
class FakeBroadcastChannel {
    static instances: FakeBroadcastChannel[] = []
    private listeners = new Set<(event: { data: unknown }) => void>()
    closed = false
    constructor(public readonly name: string) {
        FakeBroadcastChannel.instances.push(this)
    }
    postMessage(message: unknown): void {
        for (const target of FakeBroadcastChannel.instances) {
            if (target === this || target.closed) continue
            for (const listener of target.listeners) listener({ data: message })
        }
    }
    addEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
        this.listeners.add(listener)
    }
    removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
        this.listeners.delete(listener)
    }
    close(): void {
        this.closed = true
    }
}

const setDocumentVisibility = (state: 'visible' | 'hidden'): void => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
    document.dispatchEvent(new Event('visibilitychange'))
}

const resetVisibility = (): void => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
}

describe('T655 · AC5 web 分支（缺省托管 `document.visibilityState`）', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        resetVisibility()
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        mocks.getCurrentUserId.mockReturnValue('t655-user')
    })
    afterEach(() => {
        stopSyncRefreshRuntime()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        resetVisibility()
    })

    it('隐藏 ⇒ 定时器归零、5 分钟内零请求；回到可见 ⇒ **立即**拉一次再恢复 30s 周期', async () => {
        startSyncRefreshRuntime()
        expect(vi.getTimerCount()).toBe(1)

        setDocumentVisibility('hidden')
        expect(vi.getTimerCount()).toBe(0)
        await vi.advanceTimersByTimeAsync(300_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()

        setDocumentVisibility('visible')
        await vi.advanceTimersByTimeAsync(0)
        expect(mocks.resumeBackfill).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).toHaveBeenCalledTimes(1)
        expect(mocks.resumeBackfill).toHaveBeenCalledTimes(1)
    })
})

describe('T655 · AC5 桌面分支（`document` 信号惰性 ⇒ 只能由 IPC 驱动）', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        resetVisibility()
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        mocks.getCurrentUserId.mockReturnValue('t655-user')
    })
    afterEach(() => {
        stopSyncRefreshRuntime()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        resetVisibility()
    })

    it('`manageDocumentVisibility: false`（= 桌面装配值）⇒ `visibilitychange` 完全不触发门控', async () => {
        // 桌面 AppRoot.vue 的实际调用：initialVisible: true + 桥存在时 manageDocumentVisibility: false
        startSyncRefreshRuntime({ initialVisible: true, manageDocumentVisibility: false })

        setDocumentVisibility('hidden')
        // `document` 信号没接线 ⇒ 定时器**仍在**（背景节流被关闭，`visibilityState` 本就不该作判据）
        expect(vi.getTimerCount()).toBe(1)
        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).toHaveBeenCalledTimes(1)

        setDocumentVisibility('visible')
        await vi.advanceTimersByTimeAsync(0)
        expect(mocks.resumeBackfill).not.toHaveBeenCalled()
    })

    it('外部可见性信号（IPC 落地形态 `setVisible`）⇒ 托盘隐藏零请求、唤回立即拉一次', async () => {
        const runtime = startSyncRefreshRuntime({
            initialVisible: true,
            manageDocumentVisibility: false
        })
        expect(runtime).not.toBeNull()

        runtime!.setVisible(false) // 主进程 `hide` → `nao:window-visibility: false`
        expect(vi.getTimerCount()).toBe(0)
        await vi.advanceTimersByTimeAsync(300_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()

        runtime!.setVisible(true) // 主进程 `show` → `nao:window-visibility: true`
        await vi.advanceTimersByTimeAsync(0)
        expect(mocks.resumeBackfill).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).toHaveBeenCalledTimes(1)
    })
})

describe('T655 · AC10 资源清理（dispose 后零监听 / 零定时器 / 广播已释放）', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        resetVisibility()
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        mocks.getCurrentUserId.mockReturnValue('t655-user')
    })
    afterEach(() => {
        stopSyncRefreshRuntime()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        resetVisibility()
    })

    it('dispose ⇒ 定时器 0；`visibilitychange` / `online` / 广播全部不再生效', async () => {
        startSyncRefreshRuntime()
        expect(vi.getTimerCount()).toBe(1)

        stopSyncRefreshRuntime()
        expect(vi.getTimerCount()).toBe(0)

        setDocumentVisibility('hidden')
        setDocumentVisibility('visible')
        window.dispatchEvent(new Event('online'))
        await vi.advanceTimersByTimeAsync(120_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()
        expect(mocks.resumeBackfill).not.toHaveBeenCalled()

        const master = new FakeBroadcastChannel('nao-todo:pull-complete')
        master.postMessage({ type: 'pull-complete', userId: 't655-user', at: 1 })
        expect(mocks.applyForeignPullComplete).not.toHaveBeenCalled()
        // 频道本身已 close（不再参与投递）
        expect(FakeBroadcastChannel.instances.some((c) => c.closed)).toBe(true)
    })
})