import { describe, expect, it, vi } from 'vite-plus/test'
import type { AuthService } from '../../../../domain'
import type { AuthStore } from '../../../viewobjects'
import { isCredentialError } from '../error-classification'
import { AuthUseCase } from '../usecase'

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
    it('业务码 10022 / 10021（检入失败 / 参数错误）⇒ 凭证类 ⇒ 清认证', async () => {
        for (const [code, message] of [
            [10022, '检入失败'],
            [10021, '参数错误']
        ] as const) {
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