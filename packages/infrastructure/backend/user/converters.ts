import { UserConfigEntity, UserEntity } from '@nao-todo/domain/user'
import type { GetUserConfigRes, GetUserProfileRes } from '../types/user'

/**
 * 将获取用户配置响应转换为用户实体
 * @param res 获取用户配置响应
 * @returns 用户实体
 */
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

/**
 * 将获取用户配置响应转换为用户配置实体
 * @param res 获取用户配置响应
 * @returns 用户配置实体
 */
export const getUserConfigResToEntity = (res: GetUserConfigRes): UserConfigEntity => {
    return new UserConfigEntity(res.id, res.appearance, res.createdAt, res.updatedAt)
}

