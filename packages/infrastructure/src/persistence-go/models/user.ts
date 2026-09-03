// --- User ---

import { ResponseBase } from './base'

export type UserProfileRes = ResponseBase & {
    email: string
    nickname: string
    avatar: string
    role: string
    createdFrom: string
    state: number
    config: Record<string, unknown>
    deactivedAt: string
    lastRestoreAt: string
}

export type UpdateUserNicknameReq = {
    nickname: string
}

export type UpdateUserPasswordReq = {
    oldPassword: string
    newPassword: string
}

export type UpdateUserAvatarURLReq = {
    avatarURL: string
}

export type UpdateUserAvatarURLRes = {
    avatarURL: string
}

export type DeactiveUserReq = {
    password: string
}

export type ActiveUserReq = DeactiveUserReq

// --- User Session ---

export type UserSessionRes = {
    id: string
    deviceId: string
    deviceType: string
    ip4: string
    region: string
    createdAt: string
    updatedAt: string
    current: boolean
}

// --- User Config ---

export type UserConfigRes = ResponseBase & {
    appearance: string
}

export type UpdateUserConfigReq = {
    appearance?: string
}