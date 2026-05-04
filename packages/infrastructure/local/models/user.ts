import type { ModelBase } from './base'

export type UserModel = ModelBase & {
    account?: string
    email?: string
    // password?: string
    nickname: string
    avatar: string
    createdFrom?: string
    role: string
    state?: number
    config?: UserConfigModel
    deactivedAt?: string
}

export type UserConfigModel = ModelBase & {
    userId: string
    state: string
    appearance: string
}
