/**
 * 认证存储状态
 * @state isAuthenticated 是否认证
 * @state userToken 用户令牌
 */
export type AuthStoreStates = {
    isAuthenticated: boolean
}

/**
 * 认证存储接口
 */
export interface AuthStore {
    /**
     * 是否认证
     */
    getIsAuthenticated: () => AuthStoreStates['isAuthenticated']

    /**
     * 设置是否认证
     * @param isAuthenticated 是否认证
     */
    setIsAuthenticated: (isAuthenticated: AuthStoreStates['isAuthenticated']) => void

    /**
     * 清除认证数据
     */
    clearAuthData: () => void
}
