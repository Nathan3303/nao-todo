import {
    UpdateUserConfigValueObject,
    UpdateUserNicknameValueObject,
    UpdateUserPasswordValueObject,
    UserConfigEntity,
    UserEntity
} from '@nao-todo/domain/user'
import type {
    UserConfigRes,
    UpdateUserConfigReq,
    UpdateUserNicknameReq,
    UpdateUserPasswordReq,
    UserProfileRes
} from '../models/user'
import SparkMD5 from 'spark-md5'

// --- User ---

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
        res.state
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
        oldPassword: SparkMD5.hash(updateVO.oldPassword),
        newPassword: SparkMD5.hash(updateVO.newPassword)
    }
}

// --- User Config ---

/**
 * 将获取用户配置响应转换为用户配置实体
 * @param res 获取用户配置响应
 * @returns 用户配置实体
 */
export const getUserConfigRes2Entity = (res: UserConfigRes): UserConfigEntity => {
    return new UserConfigEntity(res.id, res.createdAt, res.updatedAt, res.deletedAt, res.appearance)
}

export const updateUserConfigValueObject2Req = (
    updateVO: UpdateUserConfigValueObject
): UpdateUserConfigReq => {
    return {
        appearance: updateVO.appearance
    }
}



