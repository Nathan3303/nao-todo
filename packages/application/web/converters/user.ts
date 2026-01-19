import { UserEntity } from '@nao-todo/domain/user'
import { UserProfile } from '@nao-todo/types'

export const userEntity2UserProfile = (userEntity: UserEntity): UserProfile => {
    const vo = {} as UserProfile
    vo.nickname = userEntity.nickname
    vo.email = userEntity.email
    vo.avatar = userEntity.avatar
    vo.role = userEntity.role
    vo.state = userEntity.state
    if (userEntity.createdAt) {
        vo.createdAt = userEntity.createdAt.format('YYYY-MM-DD HH:mm:ss')
    }
    if (userEntity.updatedAt) {
        vo.updatedAt = userEntity.updatedAt.format('YYYY-MM-DD HH:mm:ss')
    }
    return vo
}
