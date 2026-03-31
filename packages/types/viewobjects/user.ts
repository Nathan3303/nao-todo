import type { WithNull } from '../go'

export type UserViewObject = {
    email: string
    nickname: string
    avatar: string
    role: string
    state: number
    createdAt: string
    updatedAt: string
    config?: WithNull<UserConfigViewObject>
    // createdFrom?: string
}

export type UserConfigViewObject = {
    state: number
    theme?: string
    language?: string
}

export type UpdateUserViewObject = {
    nickname?: string
    avatar?: string
    config?: UserConfigViewObject
    role?: string
}

export type UpdateNicknameViewObject = {
    nickname: string
}

export type UpdatePasswordViewObject = {
    password: string
    newPassword: string
    confirmNewPassword: string
}
