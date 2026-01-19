import type { WithNull } from '@nao-todo/types'
import { Dayjs } from 'dayjs'

export interface UserEntity {
    email: string
    password: string
    nickname: string
    avatar: string
    role: string
    state: number
    createdAt: WithNull<Dayjs>
    updatedAt: WithNull<Dayjs>
}

export const makeUserEntity = (): UserEntity => {
    return {
        email: '',
        password: '',
        nickname: '',
        avatar: '',
        role: '',
        state: 0,
        createdAt: null,
        updatedAt: null
    }
}
