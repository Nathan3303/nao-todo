import type { GoAsync } from '@nao-todo/shared'
import type { UserConfigRepository, UserRepository } from '@nao-todo/domain/user/repositories'
import type { UserDomain } from '@nao-todo/domain/user/services'
import type {
    UpdateNicknameViewObject,
    UpdatePasswordViewObject,
    UpdateUserConfigViewObject,
    UserStore,
    UserViewObject,
    DeactiveUserViewObject,
    RestoreUserViewObject
} from '../viewobjects'
import { UpdateUserConfigValueObject } from '@nao-todo/domain/user/valueobjects'
import {
    updatePasswordViewObjectToValueObject,
    updateUserNicknameViewObjectToValueObject,
    userConfigEntityToViewObject,
    userEntityToViewObject,
    deactiveUserViewObjectToValueObject,
    restoreUserViewObjectToValueObject
} from './converters'

/**
 * 用户用例
 * @description 用户用例类，包含用户相关操作
 */
export class UserUseCase {
    // 构造函数
    constructor(
        private readonly userDomain: UserDomain, // 用户域
        private readonly userRepo: UserRepository, // 用户仓库
        private readonly userConfigRepo: UserConfigRepository, // 用户配置仓库
        private readonly userStore: UserStore // 用户存储
    ) {}

    /**
     * 加载用户信息
     * @returns 用户信息
     */
    async loadUserProfile(): GoAsync<UserViewObject> {
        // 获取用户信息
        const [userEntity, err] = await this.userRepo.getProfile()
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
        const err = await this.userRepo.updateNickname(updateUserNicknameValueObject)
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
        return await this.userRepo.updatePassword(updatePasswordValueObject)
    }

    /**
     * 加载用户配置
     * @returns 用户配置
     */
    async loadUserConfig(): GoAsync<void> {
        // 获取用户设置
        const [userConfigEntity, err] = await this.userConfigRepo.get()
        if (err !== null) return err
        // 数据转换为视图对象
        const userConfig = userConfigEntityToViewObject(userConfigEntity)
        // 存储用户配置
        this.userStore.setUserConfig(userConfig)
        // 返回
        return null
    }

    /**
     * 更新用户配置
     * @param updateUserConfigViewObject 更新用户配置视图对象
     * @returns 更新结果
     */
    async updateUserConfig(updateUserConfigViewObject: UpdateUserConfigViewObject): GoAsync<void> {
        // 创建更新用户配置值对象
        const updateUserConfigValueObject = new UpdateUserConfigValueObject()
        updateUserConfigValueObject.appearance = updateUserConfigViewObject.appearance
        // 更新用户设置
        const err = await this.userConfigRepo.save(updateUserConfigValueObject)
        if (err !== null) return err
        // 更新存储
        this.userStore.updateUserConfig(updateUserConfigViewObject)
        // 返回
        return null
    }

    /**
     * 更新用户头像文件
     * @param file 头像文件
     * @returns 更新结果
     */
    async updateAvatarFile(file: File): GoAsync<string> {
        const [avatarURL, err] = await this.userRepo.updateAvatarFile(file)
        if (err !== null) return ['', err]
        this.userStore.updateUserProfile({ avatar: avatarURL })
        return [avatarURL, null]
    }

    /**
     * 注销用户
     * @param deactiveUserViewObject 注销用户视图对象
     * @returns 更新结果
     */
    async deactive(deactiveUserViewObject: DeactiveUserViewObject): GoAsync<void> {
        if (deactiveUserViewObject.password !== deactiveUserViewObject.confirmPassword) {
            return '两次输入的密码不一致'
        }
        if (!deactiveUserViewObject.agreed) {
            return '请同意注销协议'
        }
        const deactiveUserValueObject = deactiveUserViewObjectToValueObject(deactiveUserViewObject)
        const err = await this.userRepo.deactive(deactiveUserValueObject)
        if (err !== null) return err
        this.userStore.clearAuthData()
        return null
    }

    /**
     * 撤销注销用户
     * @param restoreUserViewObject 撤销注销用户视图对象
     * @returns 更新结果
     */
    async restore(restoreUserViewObject: RestoreUserViewObject): GoAsync<void> {
        if (!restoreUserViewObject.agreed) {
            return '请同意撤销注销协议'
        }
        const restoreUserValueObject = restoreUserViewObjectToValueObject(restoreUserViewObject)
        const err = await this.userRepo.restore(restoreUserValueObject)
        if (err !== null) return err
        this.userStore.clearAuthData()
        return null
    }
}

/**
 * 创建用户用例
 * @param userStore 用户存储
 * @returns 用户用例
 */
// export const newUserUseCase = (userStore: UserStore) => {
//     const requester = getRequesterImpl()
//     const userRepo = newUserRepository(requester)
//     const userConfigRepo = newUserConfigRepository(requester)
//     const userDomain = new UserDomain(userRepo, userConfigRepo)
//     return new UserUseCase(userDomain, userRepo, userConfigRepo, userStore)
// }
