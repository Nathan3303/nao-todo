import type { UserEntity } from '@nao-todo/domain/user'
import type { GetUserProfileRes } from '../types/user'
import { makeUserEntity } from '@nao-todo/domain/user/entities'
import dayjs from 'dayjs'

export const getUserProfileRes2UserEntity = (res: GetUserProfileRes): UserEntity => {
    const e = makeUserEntity()
    e.email = res.email
    e.nickname = res.nickname
    e.avatar = res.avatar
    e.role = res.role
    e.state = res.state
    e.createdAt = dayjs(res.createdAt)
    e.updatedAt = dayjs(res.updatedAt)
    return e
}
