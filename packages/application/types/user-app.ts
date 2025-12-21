export type UpdateNicknameVO = {
    nickname: string
}

export type UserProfileVO = {
    email: string
    nickname: string
    avatar: string
    role: string
    state: number
    createdAt: string
    updatedAt: string
    createdFrom?: string
    config?: Record<string, unknown>
}
