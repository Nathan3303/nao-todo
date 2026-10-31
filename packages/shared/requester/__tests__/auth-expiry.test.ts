// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * T589 红基线 —— 失效事件单点（AC1 单一事件 + 唯一有效处理者 + 单闩；ADR D1/D4）
 *
 * 契约（`packages/shared/requester/auth-expiry.ts`，ADR D1「事件上提模块级单例」）：
 * - `fireAuthExpiry(reason)`：发布一次「会话结束」事件（reason 由 W3 横幅消费，本批只透传）；
 * - `onAuthExpiry(handler)`：注册**唯一**有效处理者（单槽：后注册替换前注册；同函数重复注册幂等）；
 * - `getAuthExpiryHandlerCount()`：当前有效处理者数（D4 判据「1 个有效处理者」）；
 * - `resetAuthExpiryLatch()`：新会话开始（登录成功）复位单闩（#260 修复③ 同口径）。
 *
 * 语义（AC1 / R5）：
 * - 重复 `fire` N 次 ⇒ 处理者只跑 **1 次**（同一次失效事件不重复导航/重复提示）；
 * - 复位后再 `fire` ⇒ 新事件重新触发（不是永久静音）；
 * - 两端重复注册**同一函数** ⇒ 仍只有 1 个处理者，且只跑 1 次（D4「后注册无害」）。
 *
 * 状态：**红**（模块尚未创建）。
 * 变异易感：把闩搬回闭包/去掉闩 ⇒ 重复 fire 断言红；处理者改为数组收集 ⇒ 有效处理者数断言红。
 */

const SPECIFIER = '../auth-expiry'

type AuthExpiryReason = 'expired' | 'signed-in-elsewhere' | 'credential-invalid'

type AuthExpiryModule = {
    fireAuthExpiry: (reason: AuthExpiryReason) => void
    onAuthExpiry: (handler: (reason: AuthExpiryReason) => void) => void
    getAuthExpiryHandlerCount: () => number
    resetAuthExpiryLatch: () => void
}

/** 缺实现装载器 */
const load = async (ac: string): Promise<AuthExpiryModule> => {
    let mod: Record<string, unknown>
    try {
        mod = (await import(/* @vite-ignore */ SPECIFIER)) as Record<string, unknown>
    } catch (error) {
        throw new Error(
            `[缺实现] 期望模块 packages/shared/requester/auth-expiry.ts（${ac}）；当前：${(error as Error).message}`
        )
    }
    const missing = [
        'fireAuthExpiry',
        'onAuthExpiry',
        'getAuthExpiryHandlerCount',
        'resetAuthExpiryLatch'
    ].filter((name) => typeof mod[name] === 'undefined')
    if (missing.length > 0) {
        throw new Error(
            `[缺实现] packages/shared/requester/auth-expiry.ts 缺少导出：${missing.join('、')}（${ac}）`
        )
    }
    return mod as unknown as AuthExpiryModule
}

describe('AC1：失效事件单点（唯一处理者 + 单闩）', () => {
    let expiry: AuthExpiryModule

    beforeEach(async () => {
        expiry = await load('AC1')
        expiry.resetAuthExpiryLatch()
    })

    it('无处理者时 fire 不抛错（启动早期/装配前安全）', () => {
        expect(() => expiry.fireAuthExpiry('expired')).not.toThrow()
    })

    it('重复 fire 3 次 ⇒ 处理者只跑 1 次（R5 幂等）', () => {
        const handler = vi.fn()
        expiry.onAuthExpiry(handler)

        expiry.fireAuthExpiry('expired')
        expiry.fireAuthExpiry('expired')
        expiry.fireAuthExpiry('signed-in-elsewhere')

        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('复位后再 fire ⇒ 新会话的新失效重新触发（不是永久静音）', () => {
        const handler = vi.fn()
        expiry.onAuthExpiry(handler)
        expiry.fireAuthExpiry('expired')
        expiry.resetAuthExpiryLatch()
        expiry.fireAuthExpiry('expired')

        expect(handler).toHaveBeenCalledTimes(2)
    })

    it('reason 透传（W3 横幅按类别推断口径）', () => {
        const handler = vi.fn()
        expiry.onAuthExpiry(handler)
        expiry.fireAuthExpiry('signed-in-elsewhere')

        expect(handler).toHaveBeenCalledWith('signed-in-elsewhere')
    })
})

describe('AC7/D4：有效处理者唯一（两端重复注册无害）', () => {
    let expiry: AuthExpiryModule

    beforeEach(async () => {
        expiry = await load('AC7')
        expiry.resetAuthExpiryLatch()
    })

    it('重复注册同一函数 ⇒ 有效处理者恰 1 个，fire 只跑 1 次', () => {
        const handler = vi.fn()
        expiry.onAuthExpiry(handler)
        expiry.onAuthExpiry(handler)

        expect(expiry.getAuthExpiryHandlerCount()).toBe(1)
        expiry.fireAuthExpiry('expired')
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('先后注册两个不同处理者 ⇒ 仍只有 1 个有效处理者（单槽，后注册胜出）', () => {
        const first = vi.fn()
        const second = vi.fn()
        expiry.onAuthExpiry(first)
        expiry.onAuthExpiry(second)

        expect(expiry.getAuthExpiryHandlerCount()).toBe(1)
        expiry.fireAuthExpiry('expired')
        expect(second).toHaveBeenCalledTimes(1)
        expect(first).not.toHaveBeenCalled()
    })
})