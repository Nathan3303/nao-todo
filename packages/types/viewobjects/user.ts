import type { WithNull } from '../go'

export type UserProfileConfig = {
    state: number
    theme?: string
    language?: string
}

export type UserProfile = {
    email: string
    nickname: string
    avatar: string
    role: string
    state: number
    createdAt: string
    updatedAt: string
    config?: WithNull<UserProfileConfig>
    createdFrom?: string
}

export type UpdateNickname = {
    nickname: string
}
