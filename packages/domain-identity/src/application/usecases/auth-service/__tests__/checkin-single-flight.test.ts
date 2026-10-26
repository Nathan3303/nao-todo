import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { AuthService } from '../../../../domain'
import type { AuthStore } from '../../../viewobjects'
import { isCredentialError, isRetryableCheckInConflict } from '../error-classification'
import { AuthUseCase } from '../usecase'

/**
 * T558 / Issue #260 残余：检入单飞 + `10022`（冲突-可重试）降级
 *
 * @description 服务端 `/auth/checkin` 是 CAS（同一 token 并发只许一次换发，败者 `10022`）⇒
 *              客户端必须：① 按 token 单飞（N 次并发 = 1 次 HTTP，结果共享，`finally` 必清）；
 *              ② `10022` **不**按凭证失效处置（不清认证、不导航），去抖 ≥300ms 后重读 token 至多重试 1 次；
 *              ③ 重试后仍 `10022` ⇒ 静默结束 + 保持认证 + 结构化记录（token 只记前缀）。
 *              ⚠️ `isCredentialError` / `NETWORK_ERROR_CODES` **未改**：`isCredentialError(10022)` 仍为 `true`，
 *              降级只发生在**使用点**（先判 `isRetryableCheckInConflict`）。
 * @see docs/reports/T557-auth-residual-blockers.md（P0-1 / P0-2 / §七 裁定）
 */

const CONFLICT_CODE = 10022

/** 服务端 CAS 败者（检入失败 = 10022） */
const conflict = (): Error =>
    Object.assign(new Error('检入失败'), { code: CONFLICT_CODE, businessCode: CONFLICT_CODE })

const session = (jwt: string) => ({ jwt, isPending: false, deadline: null })

type StoreHandle = {
    store: AuthStore
    clearAuthData: ReturnType<typeof vi.fn>
    setIsAuthenticated: ReturnType<typeof vi.fn>
    setUserToken: ReturnType<typeof vi.fn>
    /** 读取 store 内当前 token（模拟并发胜利方已落库） */
    token: () => string
    /** 直接改 store 内 token（模拟别的路径换发） */
    setToken: (token: string) => void
}

const createStore = (initialToken = 'jwt-a'): StoreHandle => {
    let current = initialToken
    const clearAuthData = vi.fn(() => {
        current = ''
    })
    const setIsAuthenticated = vi.fn()
    const setUserToken = vi.fn((token: string) => {
        current = token
    })
    const setUserDeletion = vi.fn()
    const store = {
        clearAuthData,
        setIsAuthenticated,
        setUserToken,
        setUserDeletion,
        getIsAuthenticated: () => current !== '',
        getUserToken: () => current
    } as unknown as AuthStore
    return {
        store,
        clearAuthData,
        setIsAuthenticated,
        setUserToken,
        token: () => current,
        setToken: (token: string) => {
            current = token
        }
    }
}

const createService = (checkIn: (token: string) => Promise<[unknown, unknown]>): AuthService =>
    ({ checkIn }) as unknown as AuthService

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

afterEach(() => {
    vi.restoreAllMocks()
})

describe('AuthUseCase.checkIn - 检入单飞（同一 token 合并为一个在途请求）', () => {
    it('同一 token 并发 3 次 ⇒ 仅 1 次 HTTP；3 个调用同结果；notify 只应用一次', async () => {
        const checkIn = vi.fn(async () => {
            await sleep(20)
            return [session('jwt-new'), null] as [unknown, unknown]
        })
        const { store, clearAuthData, setIsAuthenticated, setUserToken } = createStore('jwt-a')
        const useCase = new AuthUseCase(createService(checkIn), store)

        const results = await Promise.all([
            useCase.checkIn('jwt-a'),
            useCase.checkIn('jwt-a'),
            useCase.checkIn('jwt-a')
        ])

        expect(checkIn).toHaveBeenCalledTimes(1)
        expect(checkIn).toHaveBeenCalledWith('jwt-a')
        expect(results).toEqual([null, null, null])
        expect(setIsAuthenticated).toHaveBeenCalledTimes(1)
        expect(setUserToken).toHaveBeenCalledTimes(1)
        expect(setUserToken).toHaveBeenCalledWith('jwt-new')
        expect(clearAuthData).not.toHaveBeenCalled()
    })

    it('并发失败 ⇒ 共享同一错误（仍只 1 次 HTTP），`finally` 清空 ⇒ 下一次重新发起', async () => {
        const networkError = Object.assign(new Error('网络错误，请检查您的网络连接'), {
            code: 'ERR_NETWORK',
            businessCode: 50300
        })
        const checkIn = vi
            .fn<() => Promise<[unknown, unknown]>>()
            .mockResolvedValueOnce([null, networkError])
            .mockResolvedValueOnce([session('jwt-ok'), null])
        const { store, clearAuthData } = createStore('jwt-a')
        const useCase = new AuthUseCase(createService(checkIn), store)

        const [first, second] = await Promise.all([
            useCase.checkIn('jwt-a'),
            useCase.checkIn('jwt-a')
        ])
        expect(checkIn).toHaveBeenCalledTimes(1)
        expect(first).toBe(networkError)
        expect(second).toBe(networkError)
        expect(clearAuthData).not.toHaveBeenCalled()

        // 失败也清空单飞表 ⇒ 下一次必须重新发起（不被已 settled 的旧 promise 粘住）
        const retry = await useCase.checkIn('jwt-a')
        expect(retry).toBeNull()
        expect(checkIn).toHaveBeenCalledTimes(2)
    })

    it('不同 token 不得合并 ⇒ 各自发起（2 次 HTTP）', async () => {
        const checkIn = vi.fn<(token: string) => Promise<[unknown, unknown]>>(async () => {
            await sleep(10)
            return [session('jwt-x'), null] as [unknown, unknown]
        })
        const { store } = createStore('jwt-a')
        const useCase = new AuthUseCase(createService(checkIn), store)

        await Promise.all([useCase.checkIn('jwt-a'), useCase.checkIn('jwt-b')])
        expect(checkIn).toHaveBeenCalledTimes(2)
        expect(checkIn.mock.calls.map((call) => call[0])).toEqual(
            expect.arrayContaining(['jwt-a', 'jwt-b'])
        )
    })
})

describe('AuthUseCase.checkIn - 10022 冲突-可重试（降级，不清认证）', () => {
    it('10022 ⇒ 去抖 ≥300ms 后重读同一 token 重试 1 次；重试成功 ⇒ 应用新会话且不清认证', async () => {
        const checkIn = vi
            .fn<(token: string) => Promise<[unknown, unknown]>>()
            .mockResolvedValueOnce([null, conflict()])
            .mockResolvedValueOnce([session('jwt-rotated'), null])
        const { store, clearAuthData, setIsAuthenticated, setUserToken } = createStore('jwt-a')
        const useCase = new AuthUseCase(createService(checkIn), store)

        const startedAt = Date.now()
        const err = await useCase.checkIn('jwt-a')

        expect(err).toBeNull()
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(300)
        expect(checkIn).toHaveBeenCalledTimes(2)
        // 重读后的 token（与快照一致）直连 authService —— 不是回调 useCase.checkIn（否则自 join 单飞体）
        expect(checkIn.mock.calls[1]?.[0]).toBe('jwt-a')
        expect(clearAuthData).not.toHaveBeenCalled()
        expect(setIsAuthenticated).toHaveBeenCalledWith(true)
        expect(setUserToken).toHaveBeenCalledWith('jwt-rotated')
    })

    it('10022 且去抖窗口内 token 已变（并发胜利方已换发）⇒ 不重试、不清认证、静默 null', async () => {
        const handle = createStore('jwt-a')
        const checkIn = vi.fn(async () => {
            // 模拟胜利方在去抖窗口内把新 token 落到 store
            handle.setToken('jwt-winner')
            return [null, conflict()] as [unknown, unknown]
        })
        const useCase = new AuthUseCase(createService(checkIn), handle.store)

        const err = await useCase.checkIn('jwt-a')

        expect(err).toBeNull()
        expect(checkIn).toHaveBeenCalledTimes(1)
        expect(handle.clearAuthData).not.toHaveBeenCalled()
        expect(handle.token()).toBe('jwt-winner')
    })

    it('store 无 token 读取器（无法校验新鲜度）⇒ 放弃重试、保持认证、静默 null', async () => {
        const handle = createStore('jwt-a')
        delete (handle.store as { getUserToken?: unknown }).getUserToken
        const checkIn = vi.fn(async () => [null, conflict()] as [unknown, unknown])
        const useCase = new AuthUseCase(createService(checkIn), handle.store)

        const err = await useCase.checkIn('jwt-a')

        expect(err).toBeNull()
        expect(checkIn).toHaveBeenCalledTimes(1)
        expect(handle.clearAuthData).not.toHaveBeenCalled()
    })

    it('10022 两次 ⇒ 静默 null + 保持认证 + 结构化记录（code 10022，token 只记前缀）', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const secret = 'jwt-super-secret-token'
        const checkIn = vi.fn(async () => [null, conflict()] as [unknown, unknown])
        const { store, clearAuthData, setIsAuthenticated, setUserToken } = createStore(secret)
        const useCase = new AuthUseCase(createService(checkIn), store)

        const results = await Promise.all([
            useCase.checkIn(secret),
            useCase.checkIn(secret),
            useCase.checkIn(secret)
        ])

        expect(results).toEqual([null, null, null])
        // 单飞 + 最多 1 次重试 ⇒ 合计 2 次 HTTP（不是 3 个调用各重试）
        expect(checkIn).toHaveBeenCalledTimes(2)
        expect(clearAuthData).not.toHaveBeenCalled()
        expect(setIsAuthenticated).not.toHaveBeenCalled()
        expect(setUserToken).not.toHaveBeenCalled()

        const logged = JSON.stringify(warn.mock.calls)
        expect(logged).toContain(String(CONFLICT_CODE))
        expect(logged).toContain('retry-conflict')
        expect(logged).not.toContain(secret)
    })

    it('10021（参数错误）仍按凭证类清认证（仅 10022 被降级）', async () => {
        const failure = Object.assign(new Error('参数错误'), { code: 10021, businessCode: 10021 })
        const { store, clearAuthData } = createStore('jwt-stale')
        const useCase = new AuthUseCase(
            createService(async () => [null, failure]),
            store
        )

        const err = await useCase.checkIn('jwt-stale')

        expect(err).toBe(failure)
        expect(clearAuthData).toHaveBeenCalledTimes(1)
    })

    it('空 token + 10022 ⇒ 不适用降级（不可能「被并发换掉」）⇒ 仍按旧口径清认证', async () => {
        const { store, clearAuthData } = createStore('')
        const checkIn = vi.fn(async () => [null, conflict()] as [unknown, unknown])
        const useCase = new AuthUseCase(createService(checkIn), store)

        const err = await useCase.checkIn('')

        expect(err).not.toBeNull()
        expect(checkIn).toHaveBeenCalledTimes(1)
        expect(clearAuthData).toHaveBeenCalledTimes(1)
    })

    it('判定器契约未变：isCredentialError(10022) 仍为 true，新谓词只在检入处置点先判', () => {
        const err = conflict()
        expect(isCredentialError(err)).toBe(true)
        expect(isRetryableCheckInConflict(err)).toBe(true)
        // 仅 10022：其他业务码 / 无结构化 code 不得命中
        expect(
            isRetryableCheckInConflict(Object.assign(new Error('参数错误'), { code: 10021 }))
        ).toBe(false)
        expect(
            isRetryableCheckInConflict(Object.assign(new Error('会话失效'), { code: 10041 }))
        ).toBe(false)
        expect(isRetryableCheckInConflict('检入失败')).toBe(false)
        expect(isRetryableCheckInConflict(null)).toBe(false)
    })
})