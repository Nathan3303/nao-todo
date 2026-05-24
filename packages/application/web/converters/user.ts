import {
    UpdateNicknameValueObject,
    UpdatePasswordValueObject,
    UserConfigEntity,
    UserEntity
} from '@nao-todo/domain/user'
import type {
    UpdateNicknameViewObject,
    UpdatePasswordViewObject,
    UserConfigViewObject,
    UserViewObject
} from '@nao-todo/types'
import dayjs from 'dayjs'

/**
 * 将用户实体转换为用户视图对象
 * @param userEntity 用户实体
 * @returns 用户视图对象
 */
export const userEntityToViewObject = (userEntity: UserEntity): UserViewObject => {
    return {
        email: userEntity.email,
        nickname: userEntity.nickname,
        avatar: userEntity.avatar,
        role: userEntity.role,
        state: userEntity.state,
        createdAt: dayjs(userEntity.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: dayjs(userEntity.updatedAt).format('YYYY-MM-DD HH:mm:ss')
    } as UserViewObject
}

/**
 * 将更新昵称视图对象转换为更新昵称值对象
 * @param updateUserNicknameViewObject 更新昵称视图对象
 * @returns 更新昵称值对象
 */
export const updateUserNicknameViewObjectToValueObject = (
    updateUserNicknameViewObject: UpdateNicknameViewObject
): UpdateNicknameValueObject => {
    return new UpdateNicknameValueObject(updateUserNicknameViewObject.nickname)
}

/**
 * 将更新密码视图对象转换为更新密码值对象
 * @param updatePasswordViewObject 更新密码视图对象
 * @returns 更新密码值对象
 */
export const updatePasswordViewObjectToValueObject = (
    updatePasswordViewObject: UpdatePasswordViewObject
): UpdatePasswordValueObject => {
    return new UpdatePasswordValueObject(
        updatePasswordViewObject.password,
        updatePasswordViewObject.newPassword
    )
}

/**
 * 将用户配置实体转换为用户配置视图对象
 * @param userConfigEntity 用户配置实体
 * @returns 用户配置视图对象
 */
export const userConfigEntityToViewObject = (
    userConfigEntity: UserConfigEntity
): UserConfigViewObject => {
    return {
        appearance: userConfigEntity.appearance
    } as UserConfigViewObject
}

