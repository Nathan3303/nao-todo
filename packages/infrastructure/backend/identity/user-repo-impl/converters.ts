import {
    UpdateUserNicknameValueObject,
    UpdateUserPasswordValueObject,
    UserEntity
} from '@nao-todo/identity-domain'
import type {
    UpdateUserNicknameReq,
    UpdateUserPasswordReq,
    UserProfileRes
} from '../../models/user'

/**
 * 将用户配置响应转换为用户实体
 * @param res 用户配置响应
 * @returns 用户实体
 */
export const userProfile2Entity = (res: UserProfileRes): UserEntity => {
    return new UserEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.email,
        res.nickname,
        res.avatar,
        res.createdFrom,
        res.role,
        res.state,
        res.deactivedAt,
        res.lastRestoreAt
    )
}

/**
 * 将更新用户昵称值对象转换为更新用户昵称请求
 * @param updateVO 更新用户昵称值对象
 * @returns 更新用户昵称请求
 */
export const updateUserNicknameValueObject2Req = (
    updateVO: UpdateUserNicknameValueObject
): UpdateUserNicknameReq => {
    return {
        nickname: updateVO.nickname
    }
}

/**
 * 将更新用户密码值对象转换为更新用户密码请求
 * @param updateVO 更新用户密码值对象
 * @returns 更新用户密码请求
 */
export const updateUserPasswordValueObject2Req = (
    updateVO: UpdateUserPasswordValueObject
): UpdateUserPasswordReq => {
    return {
        oldPassword: updateVO.oldPassword,
        newPassword: updateVO.newPassword
    }
}