// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * T654 · AC5（**web 分支**：`document.visibilityState` 驱动）/ AC7 / AC10
 *
 * @description 运行接线层断言：
 *              - 隐藏 ⇒ 零请求、零定时器；回到可见 ⇒ **立即**通过既有恢复入口拉一次（`resumeBackfill`，
 *                合并门在服务内），随后恢复 30s 周期（`pullAll`）；
 *              - 离线 ⇒ 不建定时器；恢复联网 ⇒ 立即拉一次；
 *              - 广播命中 ⇒ 只刷新视图（`applyForeignPullComplete`），**不发网络**；
 *              - 停用 ⇒ 定时器与监听全部释放（AC10）。
 *              ⚠️ 桌面分支不走这里（`document` 在 `backgroundThrottling:false` 下恒 visible），
 *              见 `apps/desktop/src/renderer/src/window-visibility.ts` 的用例。
 * @see docs/prds/2026-11-05-sync-perception-polling.md（R-10 / AC5 / AC7 / AC10）
 */

const mocks = vi.hoisted(() => ({
    pullAll: vi.fn(async () => okResult()),
    resumeBackfill: vi.fn(async () => okResult()),
    applyForeignPullComplete: vi.fn(),
    countDirty: vi.fn(async () => 0),
    getCurrentUserId: vi.fn((): string | null => 'u-1'),
    logStructured: vi.fn()
}))

/** `SyncRunResult` 形状（成功、无凭证失败） */
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

const { startSyncRefreshRuntime, stopSyncRefreshRuntime, isSyncRefreshRuntimeRunning } =
    await import('../sync-refresh-runtime')
const { syncStatus } = await import('@nao-todo/infrastructure/src/persistence-sync/sync-status')

/** 假 `BroadcastChannel`（同步派发给其它实例，便于断言「≤2s」的即时性） */
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

describe('T654 · AC5（web）可见性门控 / AC10 清理', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        resetVisibility()
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        mocks.getCurrentUserId.mockReturnValue('u-1')
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: null, mirrorTruncated: false })
        mocks.pullAll.mockImplementation(async () => okResult())
        mocks.resumeBackfill.mockImplementation(async () => okResult())
        mocks.countDirty.mockResolvedValue(0)
    })

    afterEach(() => {
        stopSyncRefreshRuntime()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        resetVisibility()
    })

    it('可见空闲 ⇒ 每 30s 一次周期拉取（`pullAll` 既有串行入口）', async () => {
        startSyncRefreshRuntime()
        expect(vi.getTimerCount()).toBe(1)

        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).toHaveBeenCalledTimes(2)
    })

    it('标签隐藏 ⇒ 零定时器、零请求；回到可见 ⇒ 立即拉一次再恢复周期', async () => {
        startSyncRefreshRuntime()
        setDocumentVisibility('hidden')
        expect(vi.getTimerCount()).toBe(0)

        await vi.advanceTimersByTimeAsync(300_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()

        setDocumentVisibility('visible')
        await vi.advanceTimersByTimeAsync(0)
        expect(mocks.resumeBackfill).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).toHaveBeenCalledTimes(1)
    })

    it('离线 ⇒ 不建定时器；恢复联网 ⇒ 立即拉一次', async () => {
        startSyncRefreshRuntime()
        window.dispatchEvent(new Event('offline'))
        expect(vi.getTimerCount()).toBe(0)

        await vi.advanceTimersByTimeAsync(300_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()

        window.dispatchEvent(new Event('online'))
        await vi.advanceTimersByTimeAsync(0)
        expect(mocks.resumeBackfill).toHaveBeenCalledTimes(1)
    })

    it('周期拉取遇到脏队列 ⇒ 本轮不拉（`countDirty > 0`），清空后恢复', async () => {
        mocks.countDirty.mockResolvedValue(1)
        startSyncRefreshRuntime()

        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()

        mocks.countDirty.mockResolvedValue(0)
        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).toHaveBeenCalledTimes(1)
    })

    it('AC7 广播命中同用户 ⇒ 只刷新本地视图（零网络）；他人账号的消息忽略', async () => {
        startSyncRefreshRuntime()
        const [channel] = FakeBroadcastChannel.instances
        expect(channel).toBeDefined()

        // 模拟主标签广播（另一个频道实例）
        const master = new FakeBroadcastChannel('nao-todo:pull-complete')
        master.postMessage({ type: 'pull-complete', userId: 'u-1', at: 1_000 })
        expect(mocks.applyForeignPullComplete).toHaveBeenCalledWith(1_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()
        expect(mocks.resumeBackfill).not.toHaveBeenCalled()

        mocks.applyForeignPullComplete.mockClear()
        master.postMessage({ type: 'pull-complete', userId: 'other-user', at: 2_000 })
        expect(mocks.applyForeignPullComplete).not.toHaveBeenCalled()
    })

    it('T659 广播来自**他人 userId** ⇒ 忽略：不刷视图、不动新鲜度、零网络', () => {
        const OLD = '2020-01-01T00:00:00.000Z'
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: OLD, mirrorTruncated: false })
        startSyncRefreshRuntime()

        const master = new FakeBroadcastChannel('nao-todo:pull-complete')
        master.postMessage({ type: 'pull-complete', userId: 'other-user', at: Date.now() })

        expect(mocks.applyForeignPullComplete).not.toHaveBeenCalled()
        expect(syncStatus.get().mirrorPulledAt).toBe(OLD)
        expect(mocks.pullAll).not.toHaveBeenCalled()
        expect(mocks.resumeBackfill).not.toHaveBeenCalled()
    })

    it('AC10 停用 ⇒ 定时器清空、监听与广播全部释放（再触发也无请求）', async () => {
        const runtime = startSyncRefreshRuntime()
        expect(runtime).not.toBeNull()
        expect(isSyncRefreshRuntimeRunning()).toBe(true)

        stopSyncRefreshRuntime()
        expect(isSyncRefreshRuntimeRunning()).toBe(false)
        expect(vi.getTimerCount()).toBe(0)

        setDocumentVisibility('hidden')
        setDocumentVisibility('visible')
        window.dispatchEvent(new Event('online'))
        await vi.advanceTimersByTimeAsync(60_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()
        expect(mocks.resumeBackfill).not.toHaveBeenCalled()

        // 广播监听也已释放
        const master = new FakeBroadcastChannel('nao-todo:pull-complete')
        master.postMessage({ type: 'pull-complete', userId: 'u-1', at: 1_000 })
        expect(mocks.applyForeignPullComplete).not.toHaveBeenCalled()
    })

    it('启动幂等：重复 start 返回同一句柄、只保留一个定时器', () => {
        const first = startSyncRefreshRuntime()
        const second = startSyncRefreshRuntime()
        expect(second).toBe(first)
        expect(vi.getTimerCount()).toBe(1)
    })

    it('无会话 ⇒ 不发请求（登出后遗留的 tick 兜底）', async () => {
        mocks.getCurrentUserId.mockReturnValue(null)
        startSyncRefreshRuntime()
        await vi.advanceTimersByTimeAsync(30_000)
        expect(mocks.pullAll).not.toHaveBeenCalled()
    })
})