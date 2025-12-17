export type UpdateNicknameReq = {
    nickname: string
}

export type GetUserProfileRes = {
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

export type UpdateAvatarURLReq = {
    avatarURL: string
}

export type UpdateAvatarURLRes = {
    avatarURL: string
}
