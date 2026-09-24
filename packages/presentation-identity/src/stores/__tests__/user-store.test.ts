// @vitest-environment jsdom
import { USER_JWT_LOCALSTORAGE_KEY, USER_PROFILE_CACHE_KEY } from '@nao-todo/domain-identity'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { nextTick } from 'vue'
import { useUserStore } from '../user-store'

/**
 * T106 / C-52：`clearUserData` 按键删除（**禁** `localStorage.clear()`）
 * @description DEF-5 副作用回归：清认证不得抹掉 `nao.deviceId` / 主题等设备级键；
 *              `clearAuthData` 清 token 后 USER_JWT 键应被移除（而非写空串）。
 *              10041 / 被顶号路径只清身份键、不清库（K4）。
 */
describe('user-store clearUserData（C-52 / DEF-5）', () => {
    beforeEach(() => {
        localStorage.clear()
        setActivePinia(createPinia())
    })

    it('只清身份键，设备级键（nao.deviceId / 主题）保留', () => {
        localStorage.setItem('nao.deviceId', 'device-1')
        localStorage.setItem('USER_THEME_MODE', 'dark')
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt')
        localStorage.setItem(USER_PROFILE_CACHE_KEY, '{}')
        localStorage.setItem('USER_CONFIRM_UNRESTORE', 'True')

        useUserStore().clearUserData()

        expect(localStorage.getItem('nao.deviceId')).toBe('device-1')
        expect(localStorage.getItem('USER_THEME_MODE')).toBe('dark')
        expect(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)).toBeNull()
        expect(localStorage.getItem(USER_PROFILE_CACHE_KEY)).toBeNull()
        expect(localStorage.getItem('USER_CONFIRM_UNRESTORE')).toBeNull()
    })

    it('clearAuthData：token 置空后移除 USER_JWT 键（非写空串）', async () => {
        const store = useUserStore()
        store.setUserToken('jwt-1')
        await nextTick()
        expect(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)).toBe('jwt-1')

        store.clearAuthData()
        await nextTick()
        expect(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)).toBeNull()
    })
})