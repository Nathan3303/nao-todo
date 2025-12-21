import type { UserEntity } from '@nao-todo/domain/user'
import type { UserProfileVO, WithNull } from '@nao-todo/types'

export const userEntity2userProfileVO = (
    userEntity: WithNull<UserEntity>
): WithNull<UserProfileVO> => {
    if (!userEntity) return null
    const vo = {} as UserProfileVO
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
