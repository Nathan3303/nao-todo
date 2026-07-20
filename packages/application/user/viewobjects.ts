// 用户存储接口
export type UserStore = {
    getIsAuthenticated: () => boolean
    setIsAuthenticated: (isAuthenticated: boolean) => void
    clearAuthData: () => void
    profile: UserViewObject | undefined
    setUserProfile: (profile: UserViewObject) => void
    updateUserProfile: (update: Partial<UserViewObject>) => void
    config: UserConfigViewObject | undefined
    setUserConfig: (config: UserConfigViewObject) => void
    updateUserConfig: (update: Partial<UserConfigViewObject>) => void
}

// --- User ---

// 用户视图对象
export type UserViewObject = {
    email: string
    nickname: string
    avatar: string
    role: string
    state: number
    createdAt: string
    updatedAt: string
}

// 更新用户视图对象
export type UpdateUserViewObject = {
    nickname?: UserViewObject['nickname']
    avatar?: UserViewObject['avatar']
    role?: UserViewObject['role']
}

// 更新昵称视图对象
export type UpdateNicknameViewObject = {
    nickname: UserViewObject['nickname']
}

// 更新密码视图对象
export type UpdatePasswordViewObject = {
    password: string
    newPassword: string
    confirmNewPassword: string
}

// --- User Config ---

// 用户配置视图对象
export type UserConfigViewObject = {
    appearance?: string
    language?: string
}

// 更新用户配置视图对象
export type UpdateUserConfigViewObject = {
    appearance?: UserConfigViewObject['appearance']
    language?: UserConfigViewObject['language']
}

// 主题模式类型
export type ThemeMode = 'light' | 'dark' | 'system'
