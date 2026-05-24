export type GetUserProfileRes = {
    email: string
    nickname: string
    avatar: string
    role: string
    createdFrom: string
    state: number
    config: any
    createdAt: string
    updatedAt: string
}

export type UpdateNicknameReq = {
    nickname: string
}

export type UpdateAvatarURLReq = {
    avatarURL: string
}

export type UpdateAvatarURLRes = {
    avatarURL: string
}

export type DeactiveUserReq = {
    password: string
}

export type ActiveUserReq = DeactiveUserReq

export type GetUserConfigRes = {
    id: string
    appearance: string
    createdAt: string
    updatedAt: string
}

