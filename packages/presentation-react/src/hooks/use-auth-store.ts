import { useSyncExternalStore } from 'react'
import type { AuthStoreCore } from '../logic/auth-store-core'

/**
 * 认证状态 hook
 * @description 通过 useSyncExternalStore 订阅 AuthStoreCore 的状态变化，
 *              登录/登出后组件自动响应式更新。
 * @param store AuthStoreCore 实例（应用层创建单例）
 * @returns 认证状态
 */
export const useAuthStore = (store: AuthStoreCore) => {
    const isAuthenticated = useSyncExternalStore(store.subscribe, store.getIsAuthenticated)
    const userToken = useSyncExternalStore(store.subscribe, store.getUserToken)

    return {
        store,
        isAuthenticated,
        userToken
    }
}