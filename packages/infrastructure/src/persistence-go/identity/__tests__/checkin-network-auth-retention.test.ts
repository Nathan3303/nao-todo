// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { AuthService, AuthUseCase, USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { useUserStore } from '@nao-todo/presentation-identity'
import type { Requester } from '@nao-todo/shared'
import { useAuthRepository } from '../auth-repo-impl/impl'

/**
 * DEF-5 / AC7 回归线 —— checkin **网络类**失败不得清认证
 *
 * **验收判据**（PRD §7 AC7）：`G` checkin **网络类**失败 ／ `W` 触发 ／ `T` **不得** `clearAuthData`
 * （JWT 与 `nao.deviceId` 保留、可重试成功）；**凭证类**（401/403/10041）仍清。
 *
 * **现状缺陷**（探针 P1 实测确证，见 `docs/reports/2026-09-23-DEF-PROBE-P1-offline-probes.md` §6）：
 * `AuthUseCase.checkIn` **任何错误**（含网络类）都调 `authStore.clearAuthData()` →
 * `clearUserData()` → **`localStorage.clear()`** ⇒ 离线刷新一次即彻底进不去（且抹掉 `nao.deviceId`）。
 *
 * 本文件走**真实链路**：`useAuthRepository`（真实仓储）+ `AuthService` + `AuthUseCase` +
 * 真实 `useUserStore`（pinia，落 jsdom localStorage），仅把 `Requester` 换成契约替身。
 * 网络类/凭证类响应体与 `packages/shared/requester/axios.ts` 的归一化产物逐字段一致。
 */

const DEVICE_ID_KEY = 'nao.deviceId'

/** 归一化网络错误（`requester/axios.ts:96-104` 原样产物：顶层字符串 code，**不 reject**） */
const NETWORK_FAILURE = {
    code: 'ERR_NETWORK',
    data: { data: null, code: 50300, message: '网络错误，请检查您的网络连接' }
}

/** 凭证类失败（服务端业务码 10041：用户凭证验证失败） */
const CREDENTIAL_FAILURE = { data: { code: 10041, message: '用户凭证验证失败' } }

/** 成功（业务码 10020） */
const SUCCESS = {
    data: {
        code: 10020,
        message: '检登成功',
        data: { jwt: 'jwt-after-retry', pendingDeletion: false, deletedAt: '' }
    }
}

const requesterWith = (put: () => Promise<unknown>): Requester =>
    ({
        put,
        post: async () => ({ data: {} }),
        get: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

const buildUseCase = (put: () => Promise<unknown>) =>
    new AuthUseCase(new AuthService(useAuthRepository(requesterWith(put))), useUserStore())

describe('DEF-5 / AC7：checkin 网络类失败 ⇒ 保留认证（凭证类仍清）', () => {
    beforeEach(() => {
        localStorage.clear()
        setActivePinia(createPinia())
    })

    it('网络类失败 ⇒ 不得 clearAuthData（JWT 与 nao.deviceId 保留）', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-existing')
        localStorage.setItem(DEVICE_ID_KEY, 'dev-1')
        const store = useUserStore()
        const clearSpy = vi.spyOn(store, 'clearAuthData')
        const useCase = new AuthUseCase(
            new AuthService(useAuthRepository(requesterWith(async () => NETWORK_FAILURE))),
            store
        )

        const error = await useCase.checkIn('jwt-existing')
        await nextTick()

        expect(error).not.toBeNull()
        expect(clearSpy).not.toHaveBeenCalled()
        expect(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)).toBe('jwt-existing')
        expect(localStorage.getItem(DEVICE_ID_KEY)).toBe('dev-1')
    })

    it('网络类失败后可重试成功（认证保留 ⇒ 重试仍带真实 token）', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-existing')
        let response: unknown = NETWORK_FAILURE
        const useCase = buildUseCase(async () => response)

        await useCase.checkIn('jwt-existing')
        await nextTick()
        // 检入页重试时从 localStorage 取 token（`check-in.vue`：`localStorage.getItem(USER_JWT) || ''`）
        const retainedToken = localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY) ?? ''
        expect(retainedToken).not.toBe('')

        response = SUCCESS
        const retryError = await useCase.checkIn(retainedToken)
        await nextTick()

        expect(retryError).toBeNull()
        expect(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)).toBe('jwt-after-retry')
    })

    it('凭证类失败（10041）⇒ 仍清认证', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-existing')
        localStorage.setItem(DEVICE_ID_KEY, 'dev-1')
        const store = useUserStore()
        const clearSpy = vi.spyOn(store, 'clearAuthData')
        const useCase = new AuthUseCase(
            new AuthService(useAuthRepository(requesterWith(async () => CREDENTIAL_FAILURE))),
            store
        )

        const error = await useCase.checkIn('jwt-existing')
        await nextTick()

        expect(error).not.toBeNull()
        expect(clearSpy).toHaveBeenCalled()
        expect(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)).toBeFalsy()
    })

    it('成功 ⇒ 落新 token 且认证置位（契约不变）', async () => {
        const store = useUserStore()
        const useCase = new AuthUseCase(
            new AuthService(useAuthRepository(requesterWith(async () => SUCCESS))),
            store
        )

        const error = await useCase.checkIn('jwt-existing')
        await nextTick()

        expect(error).toBeNull()
        expect(store.getIsAuthenticated()).toBe(true)
        expect(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)).toBe('jwt-after-retry')
    })
})