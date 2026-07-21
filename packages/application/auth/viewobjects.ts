// 登录视图对象
export type SignInViewObject = {
    email: string
    password: string
}

// 登录结果视图对象
export type SignInSessionViewObject = {
    token: string
    pendingDeletion: boolean
    deletionDeadline?: string | null
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
    getDeletionDeadline: () => string | null
    setDeletionDeadline: (deadline: string | null) => void
    clearAuthData: () => void
}
