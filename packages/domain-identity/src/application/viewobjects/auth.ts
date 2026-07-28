// 登录视图对象
export type SignInViewObject = {
    email: string
    password: string
}

// 用户注销视图对象
export type UserDeletion = {
    isPending: boolean
    deadline?: string
}

// 登录结果视图对象
export type SignInSessionViewObject = { token: string } & UserDeletion

// 注册视图对象
export type SignUpViewObject = {
    email: string
    password: string
    confirmPassword: string
    nickname: string
}

// 认证存储接口
export type AuthStore = {
    // auth
    getIsAuthenticated: () => boolean
    setIsAuthenticated: (isAuthenticated: boolean) => void
    // user
    setUserDeletion: (userDeletion: UserDeletion) => void
    setUserToken: (userToken: string) => void
    // ---
    clearAuthData: () => void
}