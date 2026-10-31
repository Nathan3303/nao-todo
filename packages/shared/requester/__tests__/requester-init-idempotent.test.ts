// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { getRequesterImpl, initRequester } from '..'

/**
 * T589 红基线 —— AC7/D4 `initRequester` 幂等（DEF-94 双初始化）
 *
 * 现状（ADR F-1）：桌面端 `electron.vite.config.ts` 的 `@` 指向 `apps/web/src` ⇒ 挂载 `<App/>`
 * 会再跑一次 `useApp()` ⇒ `initRequester` 二次 ⇒ 两套闭包/闩/回调，「弱清理」后注册胜出。
 *
 * 改后口径（ADR D4，**不**断言「只有 1 次调用」）：
 * - 同名同 `baseURL` 连续初始化 ⇒ **复用同一实例**（`getRequesterImpl()` 同引用）；
 * - 失效回调注册到 `auth-expiry` 单例 ⇒ **有效处理者恰 1 个**，`fire` 一次回调只跑 1 次；
 * - `baseURL` 漂移 ⇒ 不静默换实例（有结构化日志），且不新增第二套闩。
 *
 * 状态：**红**（现实现每次 `initRequester` 都新建 requester 实例）。
 * 变异易感：把「同参复用」删掉 ⇒ 第一条红；把闩搬回闭包 ⇒ 第二条红。
 */

const BASE_URL = 'https://api.example.test'
/** 变量说明符：让「模块尚未创建」成为运行期「缺实现」而非转译期解析错误 */
const AUTH_EXPIRY_SPECIFIER = '../auth-expiry'

const makeLoggerSpy = (): { calls: unknown[][] } => {
    const calls: unknown[][] = []
    const sink = (...args: unknown[]) => {
        calls.push(args)
    }
    vi.spyOn(console, 'warn').mockImplementation(sink)
    vi.spyOn(console, 'log').mockImplementation(sink)
    vi.spyOn(console, 'error').mockImplementation(sink)
    return { calls }
}

describe('AC7：initRequester 幂等（同名同 baseURL 复用实例）', () => {
    it('连续两次同参初始化 ⇒ getRequesterImpl() 同引用', () => {
        const first = initRequester({ name: 'AxiosRequester', baseURL: BASE_URL })
        const second = initRequester({ name: 'AxiosRequester', baseURL: BASE_URL })

        expect(second).toBe(first)
        expect(getRequesterImpl()).toBe(first)
    })

    it('两次初始化各注册失效回调 ⇒ 有效处理者 1 个、fire 一次只跑 1 次', async () => {
        const authExpiry = (await import(/* @vite-ignore */ AUTH_EXPIRY_SPECIFIER)) as unknown as {
            getAuthExpiryHandlerCount: () => number
            fireAuthExpiry: (reason: string) => void
            resetAuthExpiryLatch: () => void
        }
        const handlerA = vi.fn()
        const handlerB = vi.fn()

        initRequester({
            name: 'AxiosRequester',
            baseURL: BASE_URL,
            onAuthExpired: handlerA
        })
        initRequester({
            name: 'AxiosRequester',
            baseURL: BASE_URL,
            onAuthExpired: handlerB
        })

        expect(authExpiry.getAuthExpiryHandlerCount()).toBe(1)
        authExpiry.resetAuthExpiryLatch()
        authExpiry.fireAuthExpiry('expired')
        expect(handlerA.mock.calls.length + handlerB.mock.calls.length).toBe(1)
    })

    it('baseURL 漂移 ⇒ 结构化日志可见（不静默换实例）', () => {
        const { calls } = makeLoggerSpy()
        initRequester({ name: 'AxiosRequester', baseURL: BASE_URL })
        const loggerAfterFirst = calls.length

        initRequester({ name: 'AxiosRequester', baseURL: 'https://other.example.test' })

        const drift = calls
            .slice(loggerAfterFirst)
            .some((args) => args.some((arg) => String(arg).toLowerCase().includes('baseurl')))
        expect(drift, '参数漂移必须留结构化日志（ADR D4 风险项）').toBe(true)
    })
})