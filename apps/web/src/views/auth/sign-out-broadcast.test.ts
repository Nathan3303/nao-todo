// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    applyRemoteSignOut,
    broadcastSignOut,
    installSignOutBroadcastListener,
    isSignOutBroadcastMessage,
    resetSignOutBroadcastForTest,
    setSignOutBroadcastChannelForTest,
    type SignOutBroadcastChannel
} from './sign-out-broadcast'

/**
 * AC16b：多标签（web）登出广播
 * @description 断言落点：**发起标签**广播登出事实；**接收标签**清 store + 跳登录页。
 *              ⚠️ 接收标签**不清库** —— `@nao-todo/infrastructure` 替身中**没有**
 *              `deletionService.wipeUserData`，若接收路径试图清库将直接抛错 ⇒ 用例转红
 *              （钉死「广播不绕过 C-54 护栏」）。
 *              降级：无 `BroadcastChannel` ⇒ 收发 no-op，不影响登出本身。
 */

const mocks = vi.hoisted(() => ({
    clear: vi.fn(),
    lock: vi.fn(),
    clearAuthData: vi.fn(),
    revokeOfflineEntry: vi.fn(),
    safeReplace: vi.fn(async () => undefined)
}))

vi.mock('@nao-todo/infrastructure', () => ({
    localSession: { clear: mocks.clear, getCurrentUserId: () => 'u-1' },
    cryptoService: { lock: mocks.lock }
}))

vi.mock('@nao-todo/presentation-identity', () => ({
    useUserStore: () => ({ clearAuthData: mocks.clearAuthData })
}))

vi.mock('@/safe-navigation', () => ({
    safeReplace: mocks.safeReplace
}))

vi.mock('./offline-entry', () => ({
    revokeOfflineEntry: mocks.revokeOfflineEntry
}))

/** 频道替身（捕获 postMessage / 手动投递 message / 记录退订） */
class FakeChannel implements SignOutBroadcastChannel {
    posted: unknown[] = []
    closed = false
    private listeners = new Set<(event: MessageEvent) => void>()

    postMessage(message: unknown): void {
        this.posted.push(message)
    }

    addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
        this.listeners.add(listener)
    }

    removeEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
        this.listeners.delete(listener)
    }

    close(): void {
        this.closed = true
    }

    /** 测试：向所有监听者投递一条消息 */
    emit(data: unknown): void {
        for (const listener of this.listeners) listener({ data } as MessageEvent)
    }

    get listenerCount(): number {
        return this.listeners.size
    }
}

const router = { resolve: vi.fn(), replace: vi.fn(async () => undefined) }

beforeEach(() => {
    vi.clearAllMocks()
    resetSignOutBroadcastForTest()
})

describe('AC16b - 发起标签广播登出事实', () => {
    it('broadcastSignOut 投递 {type,userId,at}（无 PII）', () => {
        const channel = new FakeChannel()
        setSignOutBroadcastChannelForTest(channel)

        broadcastSignOut('u-1')

        expect(channel.posted).toHaveLength(1)
        const message = channel.posted[0] as Record<string, unknown>
        expect(message.type).toBe('sign-out')
        expect(message.userId).toBe('u-1')
        expect(typeof message.at).toBe('string')
        expect(Object.keys(message).sort()).toEqual(['at', 'type', 'userId'])
    })

    it('降级：无 BroadcastChannel ⇒ 广播与监听均 no-op、不抛错', () => {
        setSignOutBroadcastChannelForTest(null)
        expect(() => broadcastSignOut('u-1')).not.toThrow()
        expect(() => installSignOutBroadcastListener(router)).not.toThrow()
    })

    it('消息守卫：形状非法一律忽略', () => {
        expect(isSignOutBroadcastMessage({ type: 'sign-out', userId: 'u-1' })).toBe(true)
        expect(isSignOutBroadcastMessage({ type: 'other', userId: 'u-1' })).toBe(false)
        expect(isSignOutBroadcastMessage({ type: 'sign-out' })).toBe(false)
        expect(isSignOutBroadcastMessage(null)).toBe(false)
        expect(isSignOutBroadcastMessage('sign-out')).toBe(false)
    })
})

describe('AC16b - 接收标签清 store + 跳登录页', () => {
    it('收到登出广播 ⇒ 清离线授权/清 store/清会话/锁密钥 + 跳 signin（不清库）', async () => {
        const channel = new FakeChannel()
        setSignOutBroadcastChannelForTest(channel)
        const unsubscribe = installSignOutBroadcastListener(router)

        channel.emit({ type: 'sign-out', userId: 'u-1', at: '2026-09-23T00:00:00.000Z' })
        await Promise.resolve()
        await Promise.resolve()

        expect(mocks.revokeOfflineEntry).toHaveBeenCalledTimes(1)
        expect(mocks.clearAuthData).toHaveBeenCalledTimes(1)
        expect(mocks.clear).toHaveBeenCalledTimes(1)
        expect(mocks.lock).toHaveBeenCalledTimes(1)
        expect(mocks.safeReplace).toHaveBeenCalledWith(
            router,
            '/auth/signin',
            'sign-out-broadcast:navigation'
        )
        unsubscribe()
    })

    it('非法消息 ⇒ 无任何反应', async () => {
        const channel = new FakeChannel()
        setSignOutBroadcastChannelForTest(channel)
        installSignOutBroadcastListener(router)

        channel.emit({ type: 'something-else' })
        channel.emit('sign-out')
        await Promise.resolve()

        expect(mocks.clearAuthData).not.toHaveBeenCalled()
        expect(mocks.safeReplace).not.toHaveBeenCalled()
    })

    it('退订后不再响应', async () => {
        const channel = new FakeChannel()
        setSignOutBroadcastChannelForTest(channel)
        const unsubscribe = installSignOutBroadcastListener(router)
        expect(channel.listenerCount).toBe(1)

        unsubscribe()
        expect(channel.listenerCount).toBe(0)

        channel.emit({ type: 'sign-out', userId: 'u-1', at: '2026-09-23T00:00:00.000Z' })
        await Promise.resolve()
        expect(mocks.clearAuthData).not.toHaveBeenCalled()
    })

    it('applyRemoteSignOut 直接调用亦不触发清库（护栏不被绕过）', async () => {
        await applyRemoteSignOut(router)
        expect(mocks.clearAuthData).toHaveBeenCalledTimes(1)
        expect(mocks.safeReplace).toHaveBeenCalledTimes(1)
    })
})