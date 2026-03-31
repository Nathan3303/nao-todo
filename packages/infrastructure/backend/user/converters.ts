import { UserEntity } from '@nao-todo/domain/user'
import type { GetUserProfileRes } from '../types/user'

export const getUserProfileRes2UserEntity = (res: GetUserProfileRes): UserEntity => {
    return new UserEntity(
        '',
        res.email,
        res.nickname,
        res.avatar,
        res.role,
        res.state,
        res.createdAt,
        res.updatedAt
    )
}
