import type { UserDeletion } from './auth'

// 用户存储接口
export type UserStore = {
    getIsAuthenticated: () => boolean
    setIsAuthenticated: (isAuthenticated: boolean) => void
    setUserDeletion: (userDeletion: UserDeletion) => void
    updateUserDeletion: (UserDeletion: UserDeletion) => void
    profile: UserViewObject | undefined
    setUserProfile: (profile: UserViewObject) => void
    updateUserProfile: (update: Partial<UserViewObject>) => void
    config: UserConfigViewObject | undefined
    setUserConfig: (config: UserConfigViewObject) => void
    updateUserConfig: (update: Partial<UserConfigViewObject>) => void
    clearAuthData: () => void
}

// --- User ---

// 用户视图对象
export type UserViewObject = {
    email: string
    nickname: string
    avatar: string
    role: string
    state: number
    deactivedAt: string
    createdAt: string
    updatedAt: string
    isInDeactiveCooldown: boolean
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

// 注销用户视图对象
export type DeactiveUserViewObject = {
    password: string
    confirmPassword: string
    agreed: boolean
}

// 撤销注销用户视图对象
export type RestoreUserViewObject = {
    password: string
    agreed: boolean
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