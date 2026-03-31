import type { ModelBase } from './base'

export type User = ModelBase & {
    account?: string
    email?: string
    // password?: string
    nickname: string
    avatar: string
    createdFrom?: string
    role: string
    state?: number
    config?: UserConfig
    deactivedAt?: string
}

export type UserConfig = ModelBase & {
    userId: string
    state: string
    appearance: string
}
