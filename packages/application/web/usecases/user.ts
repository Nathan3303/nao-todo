import type {
    GoAsync,
    UpdateNicknameViewObject,
    UpdatePasswordViewObject,
    UpdateUserViewObject,
    UserConfigViewObject,
    UserViewObject
} from '@nao-todo/types'
import { UserDomain, UpdateUserConfigValueObject } from '@nao-todo/domain/user'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useUserRepository } from '@nao-todo/infrastructure/backend/user/repoImpl'
import {
    updatePasswordViewObjectToValueObject,
    updateUserNicknameViewObjectToValueObject,
    userEntityToViewObject
} from '../converters/user'

/**
 * 用户存储
 */
interface UserStore {
    setUserProfile: (userProfile: UserViewObject) => void
    updateUserProfile: (updateUserViewObject: UpdateUserViewObject) => void
}

/**
 * 用户用例
 * @description 负责处理用户相关的业务逻辑，包括加载用户信息、更新用户昵称、更新用户密码等
 */
export class UserUseCase {
    /**
     * 用户用例构造函数
     * @param userDomain 用户领域模型
     * @param userStore 用户存储
     */
    constructor(
        private userDomain: UserDomain,
        private userStore: UserStore
    ) {}

    /**
     * 加载用户信息
     * @returns 用户信息
     */
    async loadUserProfile(): GoAsync<UserViewObject> {
        // 获取用户信息
        const [userEntity, err] = await this.userDomain.getProfile()
        if (err !== null) return [null, err]
        // 实体转换为视图对象
        const userProfile = userEntityToViewObject(userEntity)
        // 存储用户信息
        this.userStore.setUserProfile(userProfile)
        // 返回
        return [userProfile, null]
    }

    /**
     * 更新用户昵称
     * @param updateUserNicknameViewObject 更新昵称视图对象
     * @returns 更新结果
     */
    async updateNickname(updateUserNicknameViewObject: UpdateNicknameViewObject): GoAsync<void> {
        // 数据转换
        const updateUserNicknameValueObject = updateUserNicknameViewObjectToValueObject(
            updateUserNicknameViewObject
        )
        // 更新用户昵称
        const err = await this.userDomain.updateNickname(updateUserNicknameValueObject)
        if (err !== null) return err
        // 更新存储
        this.userStore.updateUserProfile({ nickname: updateUserNicknameValueObject.nickname })
        // 返回
        return null
    }

    /**
     * 更新用户密码
     * @param updatePasswordViewObject 更新密码视图对象
     * @returns 更新结果
     */
    async updatePassword(updatePasswordViewObject: UpdatePasswordViewObject): GoAsync<void> {
        // 判断新密码是否与确认密码一致
        if (updatePasswordViewObject.newPassword !== updatePasswordViewObject.confirmNewPassword) {
            return '新密码与确认密码不一致'
        }
        // 数据转换
        const updatePasswordValueObject =
            updatePasswordViewObjectToValueObject(updatePasswordViewObject)
        // 更新用户密码
        return await this.userDomain.updatePassword(updatePasswordValueObject)
    }

    /**
     * 加载用户配置
     * @returns 用户配置
     */
    async loadUserConfig(): GoAsync<UserConfigViewObject> {
        const [config, err] = await this.userDomain.getConfig()
        if (err !== null) return [null, err]
        return [config as UserConfigViewObject, null]
    }

    /**
     * 更新用户配置
     * @param appearance 外观设置值
     * @returns 更新结果
     */
    async updateUserConfig(appearance: string): GoAsync<void> {
        const valueObject = new UpdateUserConfigValueObject(appearance)
        return await this.userDomain.updateConfig(valueObject)
    }

    /**
     * 更新用户头像文件
     * @param file 头像文件
     * @returns 更新结果
     */
    async updateAvatarFile(file: File): GoAsync<string> {
        // 更新用户头像
        const [avatarURL, err] = await this.userDomain.updateAvatarFile(file)
        if (err !== null) return ['', err]
        // 更新存储
        this.userStore.updateUserProfile({ avatar: avatarURL })
        // 返回
        return [avatarURL, null]
    }

    /**
     * 创建用户用例实例
     * @param userStore 用户存储
     * @returns 用户用例实例
     */
    static create(userStore: UserStore): UserUseCase {
        const requester = getRequesterImpl()
        const repo = useUserRepository(requester)
        const domain = new UserDomain(repo)
        return new UserUseCase(domain, userStore)
    }
}


