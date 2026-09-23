import { cryptoService, localSession } from '@nao-todo/infrastructure'
import { useUserStore } from '@nao-todo/presentation-identity'
import { safeReplace, type SafeNavigationRouter } from '@/safe-navigation'
import { revokeOfflineEntry } from './offline-entry'

/**
 * 多标签（web）登出广播 —— AC16b
 *
 * @description 同 origin 的 `BroadcastChannel`：某标签**完成登出**后广播「登出事实」，
 *              其余标签据此**清 store + 跳登录页**（阶段一仅断言到此；「无残留明文」与阶段二绑定）。
 *
 *              ⚠️ **护栏关系（C-54）**：清库只由**发起标签**的 `wipeLocalDataOnSignOut`（已过
 *              `countDirty` 阻塞确认）执行；**接收标签一律不清库**（`applyRemoteSignOut` 不调
 *              `wipeUserData`），因此广播**不可能绕过护栏**。发起标签在护栏取消时根本不广播。
 *
 *              **降级**：无 `BroadcastChannel`（或构造失败）⇒ 收发均 no-op，**不影响登出本身**。
 *              监听只在 web 入口（`apps/web/src/main.ts`）安装；desktop 单窗口 + 单实例锁
 *              （AC16a）无同 origin 对端 ⇒ 天然不参与。
 *
 * @see docs/prds/2026-09-23-web-offline-stage1.md（AC16b）
 */

/** 广播频道名（同 origin 多标签共享） */
export const SIGN_OUT_BROADCAST_CHANNEL = 'nao-todo.sign-out'

/** 广播消息（字段白名单；禁 PII：仅登出事件 + 发起者 id + 时间戳） */
export type SignOutBroadcastMessage = {
    type: 'sign-out'
    userId: string
    at: string
}

/** `BroadcastChannel` 最小接口（便于测试注入与降级） */
export type SignOutBroadcastChannel = {
    postMessage: (message: unknown) => void
    addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
    removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
    close: () => void
}

/** 每标签唯一频道实例（发送者也用它；BroadcastChannel 不回投发送者 ⇒ 不会自我触发） */
let channel: SignOutBroadcastChannel | null = null
let initialized = false

/** 惰性建频道；不支持/构造失败 ⇒ null（降级） */
const getChannel = (): SignOutBroadcastChannel | null => {
    if (initialized) return channel
    initialized = true
    if (typeof BroadcastChannel === 'undefined') return null
    try {
        channel = new BroadcastChannel(SIGN_OUT_BROADCAST_CHANNEL) as SignOutBroadcastChannel
    } catch {
        channel = null
    }
    return channel
}

/** 广播消息守卫（形状校验；非法消息一律忽略） */
export const isSignOutBroadcastMessage = (data: unknown): data is SignOutBroadcastMessage => {
    if (typeof data !== 'object' || data === null) return false
    const record = data as Record<string, unknown>
    return record.type === 'sign-out' && typeof record.userId === 'string'
}

/**
 * 广播「本标签已登出」（在清库 + 清认证**之后**调用）
 * @param userId 发起登出的用户 id
 */
export const broadcastSignOut = (userId: string): void => {
    const target = getChannel()
    if (!target) return
    try {
        target.postMessage({
            type: 'sign-out',
            userId,
            at: new Date().toISOString()
        } satisfies SignOutBroadcastMessage)
    } catch {
        /* 广播失败不得影响登出本身 */
    }
}

/**
 * 其它标签登出后本标签的反应：清 store + 跳登录页
 * @description **不清库**（清库归发起标签且已过护栏）；导航失败由 `safeReplace` 结构化记录、不抛错。
 */
export const applyRemoteSignOut = async (
    router: SafeNavigationRouter | undefined
): Promise<void> => {
    revokeOfflineEntry() // C-25：登出必须清离线进入授权
    useUserStore().clearAuthData()
    localSession.clear()
    cryptoService.lock()
    await safeReplace(router, '/auth/signin', 'sign-out-broadcast:navigation')
}

/**
 * 安装登出广播监听（web 入口调用一次）
 * @returns 退订函数；无 `BroadcastChannel` ⇒ no-op
 */
export const installSignOutBroadcastListener = (
    router: SafeNavigationRouter | undefined
): (() => void) => {
    const target = getChannel()
    if (!target) return () => {}
    const onMessage = (event: MessageEvent): void => {
        if (!isSignOutBroadcastMessage(event.data)) return
        void applyRemoteSignOut(router)
    }
    target.addEventListener('message', onMessage)
    return () => target.removeEventListener('message', onMessage)
}

/** 仅测试：注入频道替身（`null` = 模拟不支持） */
export const setSignOutBroadcastChannelForTest = (fake: SignOutBroadcastChannel | null): void => {
    channel = fake
    initialized = true
}

/** 仅测试：复位频道状态 */
export const resetSignOutBroadcastForTest = (): void => {
    channel?.close()
    channel = null
    initialized = false
}