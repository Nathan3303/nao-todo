import {
    UpdateUserNicknameValueObject,
    UpdateUserPasswordValueObject,
    UserConfigEntity,
    UserEntity
} from '@nao-todo/domain/user'
import type {
    UpdateNicknameViewObject,
    UpdatePasswordViewObject,
    UserConfigViewObject,
    UserViewObject
} from './viewobjects'
import dayjs from 'dayjs'

/**
 * 将用户实体转换为用户视图对象
 * @param userEntity 用户实体
 * @returns 用户视图对象
 */
export const userEntityToViewObject = (userEntity: UserEntity): UserViewObject => {
    const viewObject = {} as UserViewObject
    viewObject.email = userEntity.email
    viewObject.nickname = userEntity.nickname
    viewObject.avatar = userEntity.avatar
    viewObject.role = userEntity.role
    viewObject.state = userEntity.state
    viewObject.createdAt = dayjs(userEntity.createdAt).format('YYYY-MM-DD HH:mm:ss')
    viewObject.updatedAt = dayjs(userEntity.updatedAt).format('YYYY-MM-DD HH:mm:ss')
    return viewObject
}

/**
 * 将更新昵称视图对象转换为更新昵称值对象
 * @param updateUserNicknameViewObject 更新昵称视图对象
 * @returns 更新昵称值对象
 */
export const updateUserNicknameViewObjectToValueObject = (
    updateUserNicknameViewObject: UpdateNicknameViewObject
): UpdateUserNicknameValueObject => {
    return new UpdateUserNicknameValueObject(updateUserNicknameViewObject.nickname)
}

/**
 * 将更新密码视图对象转换为更新密码值对象
 * @param updatePasswordViewObject 更新密码视图对象
 * @returns 更新密码值对象
 */
export const updatePasswordViewObjectToValueObject = (
    updatePasswordViewObject: UpdatePasswordViewObject
): UpdateUserPasswordValueObject => {
    return new UpdateUserPasswordValueObject(
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
    }
}

