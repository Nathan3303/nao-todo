// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { useUserStore } from '@nao-todo/presentation-identity'
import { grantOfflineEntry, revokeOfflineEntry } from './offline-entry'

/**
 * auth 守卫（beforeEnter）离线进入四条件断言（SHELL-03 附录 B-2 / C-22…C-24）
 * @description 四条件全满足 ⇒ 放行 index；**任一不满足 ⇒ 回落原三分支**（在线且 token 无效仍走
 *              signin/checkin）。**安全回归线**：登出后即使 flag 残留为 true，也不得放行 index。
 */

const mocks = vi.hoisted(() => ({
    resolveUserIdFromStoredJwt: vi.fn(),
    getCurrentUserId: vi.fn(),
    isUnlocked: false
}))

vi.mock('@nao-todo/infrastructure', () => ({
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt,
    localSession: { getCurrentUserId: mocks.getCurrentUserId },
    cryptoService: {
        get isUnlocked() {
            return mocks.isUnlocked
        }
    }
}))

const { beforeEnter } = await import('./routes')

const setSessionJwt = (jwt: string | null): void => {
    if (jwt === null) localStorage.removeItem(USER_JWT_LOCALSTORAGE_KEY)
    else localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, jwt)
}

describe('auth beforeEnter - SHELL-03 离线进入判据', () => {
    beforeEach(() => {
        localStorage.clear()
        revokeOfflineEntry()
        setActivePinia(createPinia())
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.getCurrentUserId.mockReturnValue('u-1')
        mocks.isUnlocked = true
    })

    it('四条件全满足（显式授权 + JWT 可解析 + 会话一致 + 已解锁）⇒ 放行 index', async () => {
        grantOfflineEntry()
        await expect(beforeEnter()).resolves.toBe(true)
    })

    it('① 未授权 ⇒ 回落三分支（有 JWT 未认证 ⇒ checkin）', async () => {
        setSessionJwt('jwt')
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-checkin' })
    })

    it('安全回归线：登出后即使 flag 残留 true（JWT 已清）⇒ 仍不放行 index（走 signin）', async () => {
        grantOfflineEntry()
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        setSessionJwt(null)
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-signin' })
    })

    it('② 有 flag 但 JWT 不可解析（token 无效）⇒ 回落 checkin（在线无效 token 不得进壳）', async () => {
        grantOfflineEntry()
        setSessionJwt('broken-jwt')
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-checkin' })
    })

    it('③ 内存会话与 JWT 用户不一致 ⇒ 回落 checkin', async () => {
        grantOfflineEntry()
        setSessionJwt('jwt')
        mocks.getCurrentUserId.mockReturnValue('u-2')
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-checkin' })
    })

    it('④ 本地保险库未解锁 ⇒ 回落 checkin（未输入密码不得进壳）', async () => {
        grantOfflineEntry()
        setSessionJwt('jwt')
        mocks.isUnlocked = false
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-checkin' })
    })

    it('已认证（在线正常登录）⇒ 放行 index，与 flag 无关', async () => {
        setSessionJwt('jwt')
        useUserStore().setIsAuthenticated(true)
        await expect(beforeEnter()).resolves.toBe(true)
    })
})