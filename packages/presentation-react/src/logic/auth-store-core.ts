import type {
    AuthStore,
    UserConfigViewObject,
    UserDeletion,
    UserStore,
    UserViewObject
} from '@nao-todo/domain-identity/src/application/viewobjects'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity/src/domain/constants'
import { clearAuthToken, setAuthToken } from './auth-token-core'
import { getStorageItem, removeStorageItem, setStorageItem } from './storage-core'

/**
 * 认证/用户存储实现（Lynx 端，Web 端为 Pinia 实现）
 * @description 实现 domain-identity 的 AuthStore 与 UserStore 接口（UserStore 为 AuthStore 超集）：
 *              token 持久化走 storage-core（LynxExplorer NativeLocalStorageModule 能力检测 + 内存降级），
 *              并同步到 auth-token-core（注册为 infrastructure token 提供器，供仓储取 Authorization 头）；
 *              profile/config 为内存态（Mobile MVP 不持久化）。
 */
export class AuthStoreCore implements AuthStore, UserStore {
    private isAuthenticated = false
    private userToken = ''
    private userDeletion: UserDeletion = { isPending: false }
    private userProfile: UserViewObject | undefined
    private userConfig: UserConfigViewObject | undefined
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

    // --- AuthStore ---

    getIsAuthenticated = (): boolean => this.isAuthenticated

    setIsAuthenticated = (isAuthenticated: boolean): void => {
        this.isAuthenticated = isAuthenticated
        this.notify()
    }

    setUserDeletion = (userDeletion: UserDeletion): void => {
        this.userDeletion = userDeletion
        this.notify()
    }

    updateUserDeletion = (userDeletion: UserDeletion): void => {
        this.userDeletion = userDeletion
        this.notify()
    }

    setUserToken = (userToken: string): void => {
        this.userToken = userToken
        setAuthToken(userToken)
        void setStorageItem(USER_JWT_LOCALSTORAGE_KEY, userToken)
        this.notify()
    }

    clearAuthData = (): void => {
        this.isAuthenticated = false
        this.userToken = ''
        this.userProfile = undefined
        this.userConfig = undefined
        clearAuthToken()
        void removeStorageItem(USER_JWT_LOCALSTORAGE_KEY)
        this.notify()
    }

    // --- UserStore ---

    get profile(): UserViewObject | undefined {
        return this.userProfile
    }

    setUserProfile = (profile: UserViewObject): void => {
        this.userProfile = profile
        this.notify()
    }

    updateUserProfile = (update: Partial<UserViewObject>): void => {
        if (!this.userProfile) return
        this.userProfile = { ...this.userProfile, ...update }
        this.notify()
    }

    get config(): UserConfigViewObject | undefined {
        return this.userConfig
    }

    setUserConfig = (config: UserConfigViewObject): void => {
        this.userConfig = config
        this.notify()
    }

    updateUserConfig = (update: Partial<UserConfigViewObject>): void => {
        if (!this.userConfig) return
        this.userConfig = { ...this.userConfig, ...update }
        this.notify()
    }

    // --- 扩展 getter（AuthStore/UserStore 接口外，供 UI 层读取） ---

    /**
     * 获取用户 token
     * @returns token
     */
    getUserToken = (): string => this.userToken

    /**
     * 获取用户注销信息
     * @returns 注销信息
     */
    getUserDeletion = (): UserDeletion => this.userDeletion

    /**
     * 获取用户 profile
     * @returns profile
     */
    getUserProfile = (): UserViewObject | undefined => this.userProfile
}

/**
 * 读取已持久化的 token
 * @description 应用启动时用于恢复登录态（checkIn 前）
 * @returns token 或 null
 */
export const loadStoredToken = async (): Promise<string | null> => {
    return await getStorageItem(USER_JWT_LOCALSTORAGE_KEY)
}