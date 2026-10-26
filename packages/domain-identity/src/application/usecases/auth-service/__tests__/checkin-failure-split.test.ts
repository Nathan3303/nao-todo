import { describe, expect, it, vi } from 'vite-plus/test'
import type { AuthService } from '../../../../domain'
import type { AuthStore } from '../../../viewobjects'
import { isCredentialError, isNetworkError } from '../error-classification'
import { AuthUseCase } from '../usecase'
import { getLastCheckInAttemptAt, resetCheckInAttempt } from '@nao-todo/shared/session-renewal'

/**
 * DEF-5 / AC7：checkIn 失败分流
 * @description 网络类（归一化 ERR_NETWORK / ECONNABORTED / 超时 / 5xx / 10051 限流）
 *              **不得** `clearAuthData`（保留 JWT 与设备标识，可重试）；
 *              凭证类（401/403/10041）**保持**清认证。
 */

const NETWORK_ERROR = '网络错误，请检查您的网络连接'
const TIMEOUT_ERROR = '请求超时，请稍后再试'
const RATE_LIMIT_ERROR = '请求过于频繁，请稍后再试'
const SESSION_EXPIRED = '用户凭证验证失败'
const SIGNIN_EXPIRED = '登录已过期，请重新登录'

const createStore = () => {
    const clearAuthData = vi.fn()
    const setIsAuthenticated = vi.fn()
    const setUserToken = vi.fn()
    const setUserDeletion = vi.fn()
    const store = {
        clearAuthData,
        setIsAuthenticated,
        setUserToken,
        setUserDeletion
    } as unknown as AuthStore
    return { store, clearAuthData, setIsAuthenticated, setUserToken }
}

const createService = (checkIn: (token: string) => Promise<[unknown, unknown]>): AuthService =>
    ({ checkIn }) as unknown as AuthService

describe('isCredentialError - 凭证类判定', () => {
    it('证据类凭据失效（10041 服务端文案）判定为凭证类', () => {
        expect(isCredentialError(SESSION_EXPIRED)).toBe(true)
        expect(isCredentialError(SIGNIN_EXPIRED)).toBe(true)
        expect(isCredentialError('HTTP 401')).toBe(true)
        expect(isCredentialError(new Error('403 Forbidden'))).toBe(true)
        expect(isCredentialError('10041')).toBe(true)
    })

    it('网络类（断网/超时/限流）判定为非凭证类', () => {
        expect(isCredentialError(NETWORK_ERROR)).toBe(false)
        expect(isCredentialError(TIMEOUT_ERROR)).toBe(false)
        expect(isCredentialError(RATE_LIMIT_ERROR)).toBe(false)
        expect(isCredentialError(null)).toBe(false)
    })
})

describe('isNetworkError - 网络类判定（与凭证类同一白名单、方向相反）', () => {
    it('断网/超时/限流/结构化网络码 ⇒ true', () => {
        expect(isNetworkError(NETWORK_ERROR)).toBe(true)
        expect(isNetworkError(TIMEOUT_ERROR)).toBe(true)
        expect(isNetworkError(RATE_LIMIT_ERROR)).toBe(true)
        expect(isNetworkError(Object.assign(new Error('x'), { code: 'ERR_NETWORK' }))).toBe(true)
        expect(isNetworkError(Object.assign(new Error('x'), { businessCode: 10051 }))).toBe(true)
    })

    it('业务失败（10031 参数错误 / 10041 凭证）/ 空值 ⇒ false', () => {
        expect(isNetworkError(Object.assign(new Error('参数错误'), { businessCode: 10031 }))).toBe(
            false
        )
        expect(isNetworkError(SESSION_EXPIRED)).toBe(false)
        expect(isNetworkError(null)).toBe(false)
        expect(isNetworkError('')).toBe(false)
    })
})

describe('AuthUseCase.checkIn - DEF-5 失败分流', () => {
    it('网络类失败：不得 clearAuthData（JWT/设备标识保留，允许重试）', async () => {
        const { store, clearAuthData } = createStore()
        const useCase = new AuthUseCase(
            createService(async () => [null, NETWORK_ERROR]),
            store
        )
        const err = await useCase.checkIn('jwt-kept')
        expect(err).toBe(NETWORK_ERROR)
        expect(clearAuthData).not.toHaveBeenCalled()
    })

    it('超时/限流失败：同样不得 clearAuthData', async () => {
        for (const message of [TIMEOUT_ERROR, RATE_LIMIT_ERROR]) {
            const { store, clearAuthData } = createStore()
            const useCase = new AuthUseCase(
                createService(async () => [null, message]),
                store
            )
            await useCase.checkIn('jwt-kept')
            expect(clearAuthData).not.toHaveBeenCalled()
        }
    })

    it('凭证类失败：保持清认证', async () => {
        for (const message of [SESSION_EXPIRED, SIGNIN_EXPIRED]) {
            const { store, clearAuthData } = createStore()
            const useCase = new AuthUseCase(
                createService(async () => [null, message]),
                store
            )
            await useCase.checkIn('jwt-stale')
            expect(clearAuthData).toHaveBeenCalledTimes(1)
        }
    })

    it('网络类失败后可重试成功（不因认证被清而落登录页）', async () => {
        const { store, clearAuthData, setUserToken, setIsAuthenticated } = createStore()
        const checkIn = vi
            .fn<() => Promise<[unknown, unknown]>>()
            .mockResolvedValueOnce([null, NETWORK_ERROR])
            .mockResolvedValueOnce([
                { jwt: 'jwt-refreshed', pendingDeletion: false, deletionDeadline: undefined },
                null
            ])
        const useCase = new AuthUseCase(createService(checkIn), store)

        const firstError = await useCase.checkIn('jwt-kept')
        expect(firstError).toBe(NETWORK_ERROR)
        expect(clearAuthData).not.toHaveBeenCalled()

        const secondError = await useCase.checkIn('jwt-kept')
        expect(secondError).toBeNull()
        expect(setIsAuthenticated).toHaveBeenCalledWith(true)
        expect(setUserToken).toHaveBeenCalledWith('jwt-refreshed')
    })

    it('成功：设置认证态与 token，不清认证', async () => {
        const { store, clearAuthData, setUserToken } = createStore()
        const useCase = new AuthUseCase(
            createService(async () => [
                { jwt: 'jwt-ok', pendingDeletion: false, deletionDeadline: undefined },
                null
            ]),
            store
        )
        const err = await useCase.checkIn('jwt-ok')
        expect(err).toBeNull()
        expect(setUserToken).toHaveBeenCalledWith('jwt-ok')
        expect(clearAuthData).not.toHaveBeenCalled()
    })
})

/**
 * C-67 / r11（DEF-33）：判据方向 = **网络白名单 + code 优先**
 * @description 仅归一化网络类（`ERR_NETWORK` / `ECONNABORTED` / `50300` / `40800` / `42900` / `10051`）
 *              保留认证；**其余一律凭证类**（含未知/新增业务码）—— 等价 `v1.9.0` + DEF-5 豁免，
 *              且不依赖服务端文案（闭合 DEF-25）。
 */
describe('C-67：checkin 分类 = 网络白名单 + code 优先（DEF-33）', () => {
    // T558：`10022`（服务端 CAS 冲突）已从「凭证失效」**使用点**降级为「冲突-可重试」
    // （不清认证 / 不导航 / 去抖后重试 1 次），见 `checkin-single-flight.test.ts`。
    // 共享判定器未改：`isCredentialError(10022)` 仍为 `true`（仅使用点先判 `isRetryableCheckInConflict`）。
    it('业务码 10021（参数错误）⇒ 凭证类 ⇒ 清认证', async () => {
        for (const [code, message] of [[10021, '参数错误']] as const) {
            const { store, clearAuthData } = createStore()
            const failure = Object.assign(new Error(message), { code, businessCode: code })
            const useCase = new AuthUseCase(
                createService(async () => [null, failure]),
                store
            )

            const err = await useCase.checkIn('jwt-stale')

            expect(err).toBe(failure)
            expect(isCredentialError(err)).toBe(true)
            expect(clearAuthData).toHaveBeenCalledTimes(1)
        }
    })

    it('归一化网络类（ERR_NETWORK / 50300 / 10051）⇒ 非凭证 ⇒ 保留认证', async () => {
        const networkFailures = [
            Object.assign(new Error('网络错误，请检查您的网络连接'), {
                code: 'ERR_NETWORK',
                businessCode: 50300
            }),
            Object.assign(new Error('请求失败'), { code: 10051, businessCode: 10051 })
        ]
        for (const failure of networkFailures) {
            const { store, clearAuthData } = createStore()
            const useCase = new AuthUseCase(
                createService(async () => [null, failure]),
                store
            )

            const err = await useCase.checkIn('jwt-kept')

            expect(isCredentialError(err)).toBe(false)
            expect(clearAuthData).not.toHaveBeenCalled()
        }
    })

    it('code 缺失时的回落语义：未知文案 ⇒ 凭证（安全默认）；仓内归一化文案 ⇒ 非凭证', () => {
        // 未知文案 / 未知码 ⇒ 凭证（不得被网络白名单漏判）
        expect(isCredentialError('请求失败')).toBe(true)
        expect(isCredentialError(Object.assign(new Error('未知'), { code: 99999 }))).toBe(true)
        // 仓内归一化网络文案 ⇒ 非凭证
        expect(isCredentialError('网络错误，请检查您的网络连接')).toBe(false)
        expect(isCredentialError('请求超时，请稍后再试')).toBe(false)
        // 空值防御：显式 false
        expect(isCredentialError(null)).toBe(false)
        expect(isCredentialError('')).toBe(false)
    })
})
/**
 * Issue #260 修复①回归：登录成功即记录 checkin 发起时刻，且必须在 `setUserToken` **之前**
 * @description 顺序硬要求（arch §四）：store watch 微任务先于用例续体执行 —— 晚于 setUserToken
 *              才记录 ⇒ 桌面续期调度器 `start()` 同步段读到 null ⇒ 立即用旧 token 补发 checkin
 *              ⇒ 服务端轮换 ⇒ 在途请求 10041 ⇒ 被登出 ⇒ 「登录成功但卡在登录页」。
 */
describe('AuthUseCase.signIn - #260 修复①：发起时刻先于 setUserToken 记录', () => {
    it('signIn 成功 ⇒ 记录发起时刻且先于 setUserToken（晚记 = 调度器已读 null）', async () => {
        resetCheckInAttempt()
        const { store, setUserToken } = createStore()
        // 在 setUserToken 执行的瞬间采样发起记录：非 null ⇒ 记录确实先于 setUserToken
        let attemptAtWhenTokenSet: number | null | 'unset' = 'unset'
        setUserToken.mockImplementation(() => {
            attemptAtWhenTokenSet = getLastCheckInAttemptAt()
        })
        const authService = {
            signIn: async () => [{ jwt: 'jwt-new', isPending: false, deadline: null }, null]
        } as unknown as AuthService
        const useCase = new AuthUseCase(authService, store)

        const err = await useCase.signIn({ email: 'a@b.c', password: 'pw' } as never)

        expect(err).toBeNull()
        expect(attemptAtWhenTokenSet).not.toBe('unset')
        expect(attemptAtWhenTokenSet).not.toBeNull()
    })

    it('signIn 失败 ⇒ 不记录发起时刻（未换发新 token，调度器不应被误安抚）', async () => {
        resetCheckInAttempt()
        const { store } = createStore()
        const authService = {
            signIn: async () => [null, '账号或密码错误']
        } as unknown as AuthService
        const useCase = new AuthUseCase(authService, store)

        await useCase.signIn({ email: 'a@b.c', password: 'bad' } as never)

        expect(getLastCheckInAttemptAt()).toBeNull()
    })
})