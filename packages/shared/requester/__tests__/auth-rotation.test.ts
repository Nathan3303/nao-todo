// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * T544 · 10041 轮换宽限（专项探针，R2 / AC6 / T3）
 *
 * @description 续期换发新 token 会让**旧 token 立即失效** ⇒ 在途请求收到 10041 ⇒ 误判「被下线」
 *              并清凭证自伤登出。护栏：`markTokenRotated()` 之后 **10s 内**到达的 10041 **不触发登出**
 *              （不置 `authExpiredFired`，该请求如实失败），宽限**单次**；10s 外的真实失效仍正常登出。
 *              **Web 端从不 `mark` ⇒ 行为零变化**（本文件用「未 mark ⇒ 立即登出」证明）。
 *
 * 期望实现落点：`packages/shared/requester/auth-rotation.ts`（+ `axios.ts` 分支）
 * 契约：`TOKEN_ROTATION_GRACE_MS` / `markTokenRotated(now?)` / `consumeRotationGrace(now?)` /
 *       `resetTokenRotation()`；`axios.ts` 的 10041 分支在触发登出前消费宽限。
 * @see docs/reports/T543-arch-review.md（§五 5.3 护栏 / §六 轮换竞态 / R2）
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（§八 R2）
 */

const MODULE = 'packages/shared/requester/auth-rotation.ts'
const SPECIFIER = '../auth-rotation'
const GRACE_MS = 10_000

interface AuthRotationModule {
    TOKEN_ROTATION_GRACE_MS: number
    markTokenRotated(now?: number): void
    consumeRotationGrace(now?: number): boolean
    resetTokenRotation(): void
}

/** 缺实现装载器（变量说明符 ⇒ 逐条用例给出「缺实现」原因） */
const load = async (ac: string): Promise<AuthRotationModule> => {
    let mod: Record<string, unknown>
    try {
        mod = (await import(/* @vite-ignore */ SPECIFIER)) as Record<string, unknown>
    } catch (error) {
        throw new Error(`[缺实现] 期望模块 ${MODULE}（${ac}）；当前：${(error as Error).message}`)
    }
    const missing = ['TOKEN_ROTATION_GRACE_MS', 'markTokenRotated', 'consumeRotationGrace'].filter(
        (name) => typeof mod[name] === 'undefined'
    )
    if (missing.length > 0) {
        throw new Error(`[缺实现] ${MODULE} 缺少导出：${missing.join('、')}（${ac}）`)
    }
    return mod as unknown as AuthRotationModule
}

describe('轮换宽限（纯逻辑，R2）', () => {
    it('宽限窗 = 10s（评审定值）', async () => {
        const rotation = await load('R2')

        expect(rotation.TOKEN_ROTATION_GRACE_MS).toBe(GRACE_MS)
    })

    it('未经轮换（Web 端现状）⇒ 不消费任何宽限（零行为变化）', async () => {
        const rotation = await load('R2')
        rotation.resetTokenRotation()

        expect(rotation.consumeRotationGrace(1000)).toBe(false)
    })

    it('轮换后 10s 内 ⇒ 消费成功一次（在途旧 token 的 10041 被宽限）', async () => {
        const rotation = await load('R2')
        rotation.resetTokenRotation()
        rotation.markTokenRotated(10_000)

        expect(rotation.consumeRotationGrace(10_500)).toBe(true)
    })

    it('宽限只护**一次**：同一轮换窗口内第二个 10041 不再宽限', async () => {
        const rotation = await load('R2')
        rotation.resetTokenRotation()
        rotation.markTokenRotated(10_000)

        expect(rotation.consumeRotationGrace(10_100)).toBe(true)
        expect(rotation.consumeRotationGrace(10_200)).toBe(false)
    })

    it('窗口边界内侧（9.999s）仍宽限；明显越过（10.001s）不再宽限', async () => {
        const rotation = await load('R2')
        rotation.resetTokenRotation()
        rotation.markTokenRotated(0)

        expect(rotation.consumeRotationGrace(GRACE_MS - 1)).toBe(true)

        rotation.markTokenRotated(0)
        expect(rotation.consumeRotationGrace(GRACE_MS + 1)).toBe(false)
    })

    it('再次轮换会重新武装窗口（连续续期可用）', async () => {
        const rotation = await load('R2')
        rotation.resetTokenRotation()
        rotation.markTokenRotated(0)
        expect(rotation.consumeRotationGrace(1_000)).toBe(true)

        rotation.markTokenRotated(9_000)
        expect(rotation.consumeRotationGrace(15_000)).toBe(true)
    })

    it('resetTokenRotation ⇒ 清除窗口（登出/测试隔离用）', async () => {
        const rotation = await load('R2')
        rotation.markTokenRotated(0)

        rotation.resetTokenRotation()

        expect(rotation.consumeRotationGrace(1_000)).toBe(false)
    })
})

describe('轮换宽限 · 请求器接线（R2 / AC6）', () => {
    /** axios 假实例：只为捕获响应拦截器（不发起真实网络） */
    const captured = vi.hoisted(() => ({
        successHandlers: [] as Array<(response: unknown) => unknown>,
        errorHandlers: [] as Array<(error: unknown) => Promise<unknown>>
    }))

    vi.mock('axios', () => {
        const instance = {
            interceptors: {
                request: { use: () => undefined },
                response: {
                    use: (
                        onSuccess: (response: unknown) => unknown,
                        onError: (error: unknown) => Promise<unknown>
                    ) => {
                        captured.successHandlers.push(onSuccess)
                        captured.errorHandlers.push(onError)
                    }
                }
            }
        }
        return {
            default: { create: () => instance },
            AxiosError: class AxiosError extends Error {}
        }
    })

    const createRequester = async (onAuthExpired: () => void) => {
        const { default: useAxiosRequester } = await import('../axios')
        useAxiosRequester('http://localhost:3302', false, onAuthExpired)
        const handler = captured.successHandlers.at(-1)
        if (!handler) throw new Error('请求器未注册响应拦截器')
        return handler
    }

    /** 如实返回 HTTP 200 携带业务码 10041 的响应（成功分支同样要判 10041） */
    const emit10041 = async (handler: (response: unknown) => unknown) => {
        const response = { data: { code: 10041, message: '会话已失效' } }
        return { response, result: await handler(response) }
    }

    afterEach(async () => {
        const rotation = await load('R2')
        rotation.resetTokenRotation()
        vi.useRealTimers()
    })

    it('未 mark（Web 端）⇒ 10041 立即触发登出（行为零变化）', async () => {
        const onAuthExpired = vi.fn()
        const handler = await createRequester(onAuthExpired)

        await emit10041(handler)

        expect(onAuthExpired).toHaveBeenCalledTimes(1)
    })

    it('宽限内（mark 后 2s）⇒ 10041 不触发登出，且响应如实返回（不伪造成功）', async () => {
        const onAuthExpired = vi.fn()
        const handler = await createRequester(onAuthExpired)
        const rotation = await load('R2')
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-25T00:00:00.000Z'))
        rotation.markTokenRotated()

        vi.setSystemTime(new Date('2026-10-25T00:00:02.000Z'))
        const { response, result } = await emit10041(handler)

        expect(onAuthExpired).not.toHaveBeenCalled()
        expect(result).toBe(response)
        expect((result as { data: { code: number } }).data.code).toBe(10041)
    })

    it('宽限过后（mark 后 11s）的真实失效 ⇒ 仍正常登出（不放过真下线）', async () => {
        const onAuthExpired = vi.fn()
        const handler = await createRequester(onAuthExpired)
        const rotation = await load('R2')
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-25T00:00:00.000Z'))
        rotation.markTokenRotated()

        vi.setSystemTime(new Date('2026-10-25T00:00:11.000Z'))
        await emit10041(handler)

        expect(onAuthExpired).toHaveBeenCalledTimes(1)
    })

    it('宽限被消费后，下一次 10041 仍登出（不置 authExpiredFired 的语义保持：只回调一次）', async () => {
        const onAuthExpired = vi.fn()
        const handler = await createRequester(onAuthExpired)
        const rotation = await load('R2')
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-25T00:00:00.000Z'))
        rotation.markTokenRotated()

        await emit10041(handler)
        expect(onAuthExpired).not.toHaveBeenCalled()

        await emit10041(handler)
        await emit10041(handler)
        expect(onAuthExpired).toHaveBeenCalledTimes(1)
    })
})