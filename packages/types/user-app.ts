export type UpdateNicknameVO = {
    nickname: string
}

export type UserProfileVO = {
    email: string
    nickname: string
    avatar: string
    role: string
    createdFrom: string
    state: number
    createdAt: string
    updatedAt: string
    config: Record<string, unknown>
}
