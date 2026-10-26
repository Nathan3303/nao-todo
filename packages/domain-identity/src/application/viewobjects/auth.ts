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
    /**
     * 读取当前 token（可选；T558 检入冲突重试前**重读**用）
     * @description 可选以保持既有实现（含移动端 `AuthStoreCore`）零改动：
     *              未提供 ⇒ 冲突重试无法校验 token 新鲜度 ⇒ 放弃重试（保守，仍保持认证）。
     */
    getUserToken?: () => string
    // ---
    clearAuthData: () => void
}