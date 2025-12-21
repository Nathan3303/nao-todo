import type { WithNull } from '../go'

export type UserProfileConfigVO = {
    state: number
    theme?: string
    language?: string
}

export type UserProfileVO = {
    email: string
    nickname: string
    avatar: string
    role: string
    state: number
    createdAt: string
    updatedAt: string
    config?: WithNull<UserProfileConfigVO>
    createdFrom?: string
}

export type UpdateNicknameVO = {
    nickname: string
}
