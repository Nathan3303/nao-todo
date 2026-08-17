import type { AuthStore, UserDeletion } from '@nao-todo/domain-identity/src/application/viewobjects'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity/src/domain/constants'
import { getStorageItem, removeStorageItem, setStorageItem } from './storage-core'

/**
 * 认证存储实现
 * @description 实现 domain-identity 的 AuthStore 接口（Lynx 端，Web 端为 Pinia 实现）。
 *              token 持久化走 storage-core（LynxExplorer NativeLocalStorageModule 能力检测 + 内存降级）。
 */
export class AuthStoreCore implements AuthStore {
    private isAuthenticated = false
    private userToken = ''
    private userDeletion: UserDeletion = { isPending: false }
    private listeners = new Set<() => void>()

    /**
     * 订阅状态变化
     * @description 供 useSyncExternalStore（ReactLynx / React）驱动 UI 响应式更新
     * @param listener 监听器
     * @returns 取消订阅函数
     */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify = (): void => {
        this.listeners.forEach((listener) => listener())
    }

    getIsAuthenticated = (): boolean => this.isAuthenticated

    setIsAuthenticated = (isAuthenticated: boolean): void => {
        this.isAuthenticated = isAuthenticated
        this.notify()
    }

    setUserDeletion = (userDeletion: UserDeletion): void => {
        this.userDeletion = userDeletion
        this.notify()
    }

    setUserToken = (userToken: string): void => {
        this.userToken = userToken
        void setStorageItem(USER_JWT_LOCALSTORAGE_KEY, userToken)
        this.notify()
    }

    clearAuthData = (): void => {
        this.isAuthenticated = false
        this.userToken = ''
        void removeStorageItem(USER_JWT_LOCALSTORAGE_KEY)
        this.notify()
    }

    /**
     * 获取用户 token（AuthStore 接口外的扩展 getter，供 UI 层读取）
     * @returns token
     */
    getUserToken = (): string => this.userToken

    /**
     * 获取用户注销信息（AuthStore 接口外的扩展 getter，供 UI 层读取）
     * @returns 注销信息
     */
    getUserDeletion = (): UserDeletion => this.userDeletion
}

/**
 * 读取已持久化的 token
 * @description 应用启动时用于恢复登录态（checkIn 前）
 * @returns token 或 null
 */
export const loadStoredToken = async (): Promise<string | null> => {
    return await getStorageItem(USER_JWT_LOCALSTORAGE_KEY)
}