// 登录视图对象
export type SignInViewObject = {
    email: string
    password: string
}

// 注册视图对象
export type SignUpViewObject = {
    email: string
    password: string
    confirmPassword: string
    nickname: string
}

// 认证存储接口
export type AuthStore = {
    getIsAuthenticated: () => boolean
    setIsAuthenticated: (isAuthenticated: boolean) => void
    clearAuthData: () => void
}

