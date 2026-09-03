import { UserConfigEntity } from '@nao-todo/domain-identity'
import type { UpdateUserConfigReq, UserConfigRes } from '../../models/user'

/**
 * 将获取用户配置响应转换为用户配置实体
 * @param res 获取用户配置响应
 * @returns 用户配置实体
 */
export const getUserConfigRes2Entity = (res: UserConfigRes): UserConfigEntity => {
    return new UserConfigEntity(res.id, res.createdAt, res.updatedAt, res.deletedAt, res.appearance)
}

export const updateUserConfigValueObject2Req = (
    userConfigEntity: UserConfigEntity
): UpdateUserConfigReq => {
    return {
        appearance: userConfigEntity.appearance
    }
}