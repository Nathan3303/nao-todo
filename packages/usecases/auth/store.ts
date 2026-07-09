/**
 * 认证存储接口
 */
export interface AuthStore {
    /**
     * 设置是否认证
     * @param isAuthenticated 是否认证
     */
    setIsAuthenticated: (isAuthenticated: boolean) => void

    /**
     * 设置用户令牌
     * @param userToken 用户令牌
     */
    setUserToken: (userToken: string) => void

    /**
     * 清除用户数据
     */
    clearUserData: () => void
}

