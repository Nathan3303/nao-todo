import {
    UpdateUserNicknameValueObject,
    UpdateUserPasswordValueObject,
    UserEntity,
    UserSessionValueObject
} from '@nao-todo/domain-identity'
import type {
    UpdateUserNicknameReq,
    UpdateUserPasswordReq,
    UserProfileRes,
    UserSessionRes
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

/**
 * 将会话响应转换为会话值对象
 * @param res 会话响应
 * @returns 会话值对象
 */
export const userSessionRes2ValueObject = (res: UserSessionRes): UserSessionValueObject => {
    return new UserSessionValueObject(
        res.id,
        res.deviceId,
        res.deviceType,
        res.ip4,
        res.region,
        res.createdAt,
        res.updatedAt,
        res.current
    )
}