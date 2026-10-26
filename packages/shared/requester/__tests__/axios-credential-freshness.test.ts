// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * T558 / Issue #260 残余：失效处置的 **token 一致性判据**（axios 请求器）
 *
 * @description 失效判据必须是「**当前** token 失效」，不是「收到了 10041」：
 *              - 请求发出时的 token 快照（`config.headers.Authorization`）≠ 当前 token ⇒ **陈旧响应**：
 *                不登出、不清凭证、不导航，只记录；
 *              - `Bearer null` / 无 Authorization ⇒ 同样按陈旧处理（顺带降级 DEF-93 危害）；
 *              - 快照 === 当前 token ⇒ 真实失效，仍登出（宽限窗内仍放行，R2 语义不变）；
 *              - 未注入 `getAuthToken` ⇒ 保持旧口径（收到 10041 即登出），零行为变化。
 * @see docs/reports/T557-auth-residual-blockers.md（P0-1 / P1-5）
 */

const captured = vi.hoisted(() => ({
    successHandlers: [] as Array<(response: unknown) => unknown>
}))

vi.mock('axios', () => {
    const instance = {
        interceptors: {
            request: { use: () => undefined },
            response: {
                use: (onSuccess: (response: unknown) => unknown) => {
                    captured.successHandlers.push(onSuccess)
                }
            }
        }
    }
    return {
        default: { create: () => instance },
        AxiosError: class AxiosError extends Error {}
    }
})

type CreateOptions = {
    onAuthExpired: () => void
    getAuthToken?: () => string | null
}

const createHandler = async (options: CreateOptions) => {
    const { default: useAxiosRequester } = await import('../axios')
    useAxiosRequester('http://localhost:3302', false, options.onAuthExpired, options.getAuthToken)
    const handler = captured.successHandlers.at(-1)
    if (!handler) throw new Error('请求器未注册响应拦截器')
    return handler
}

/** HTTP 200 + 业务码 10041，并带上该请求自己的 Authorization（token 快照） */
const emit10041 = async (
    handler: (response: unknown) => unknown,
    authorization?: string
): Promise<unknown> => {
    const response = {
        data: { code: 10041, message: '会话已失效' },
        config: { headers: authorization === undefined ? {} : { Authorization: authorization } }
    }
    return handler(response)
}

afterEach(async () => {
    const rotation = await import('../auth-rotation')
    rotation.resetTokenRotation()
})

describe('axios 10041 · token 一致性（T558）', () => {
    it('请求快照 ≠ 当前 token ⇒ 陈旧响应：不登出、只记录', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const onAuthExpired = vi.fn()
        const handler = await createHandler({
            onAuthExpired,
            getAuthToken: () => 'jwt-current'
        })

        await emit10041(handler, 'Bearer jwt-stale')

        expect(onAuthExpired).not.toHaveBeenCalled()
        const logged = JSON.stringify(warn.mock.calls)
        expect(logged).toContain('auth.credential.stale')
        expect(logged).not.toContain('jwt-stale')
        warn.mockRestore()
    })

    it('`Bearer null`（空凭证）⇒ 一律按陈旧处理：不登出', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const onAuthExpired = vi.fn()
        const handler = await createHandler({
            onAuthExpired,
            getAuthToken: () => 'jwt-current'
        })

        await emit10041(handler, 'Bearer null')

        expect(onAuthExpired).not.toHaveBeenCalled()
        warn.mockRestore()
    })

    it('请求未带 Authorization ⇒ 视为陈旧（无凭据的请求不可能代表当前会话失效）', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const onAuthExpired = vi.fn()
        const handler = await createHandler({
            onAuthExpired,
            getAuthToken: () => 'jwt-current'
        })

        await emit10041(handler)

        expect(onAuthExpired).not.toHaveBeenCalled()
        warn.mockRestore()
    })

    it('快照 === 当前 token（宽限窗外）⇒ 真实失效，仍登出 1 次', async () => {
        const onAuthExpired = vi.fn()
        const handler = await createHandler({
            onAuthExpired,
            getAuthToken: () => 'jwt-current'
        })

        await emit10041(handler, 'Bearer jwt-current')

        expect(onAuthExpired).toHaveBeenCalledTimes(1)
    })

    it('快照 === 当前 token 且轮换宽限内 ⇒ 不登出（R2 语义保持）', async () => {
        const rotation = await import('../auth-rotation')
        rotation.resetTokenRotation()
        rotation.markTokenRotated()
        const onAuthExpired = vi.fn()
        const handler = await createHandler({
            onAuthExpired,
            getAuthToken: () => 'jwt-current'
        })

        await emit10041(handler, 'Bearer jwt-current')

        expect(onAuthExpired).not.toHaveBeenCalled()
    })

    it('未注入 token 读取器 ⇒ 保持旧口径（收到 10041 即登出，两端行为零变化）', async () => {
        const onAuthExpired = vi.fn()
        const handler = await createHandler({ onAuthExpired })

        await emit10041(handler, 'Bearer jwt-whatever')

        expect(onAuthExpired).toHaveBeenCalledTimes(1)
    })

    it('当前已无 token（已登出）⇒ 陈旧响应，不重复登出', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const onAuthExpired = vi.fn()
        const handler = await createHandler({
            onAuthExpired,
            getAuthToken: () => null
        })

        await emit10041(handler, 'Bearer jwt-stale')

        expect(onAuthExpired).not.toHaveBeenCalled()
        warn.mockRestore()
    })
})