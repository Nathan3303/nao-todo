import { unwrapError } from '@nao-todo/infrastructure/utils'
import type { GoAsync } from '@nao-todo/types'
import { UserEntity } from './entities'
import type { UserConfigEntity } from './entities/user-config'
import type { UserRepository } from './repositories'
import {
    UpdateNicknameValueObject,
    UpdatePasswordValueObject,
    UpdateUserConfigValueObject
} from './valueobjects'

export class UserDomain {
    /**
     * 用户域服务
     * @param userRepo 用户存储库
     */
    constructor(private userRepo: UserRepository) {}

    /**
     * 获取用户个人信息
     * @returns 用户个人信息
     */
    async getProfile(): GoAsync<UserEntity> {
        return await this.userRepo.getProfile()
    }

    /**
     * 更新用户昵称
     * @param updateNicknameValueObject 更新用户昵称值对象
     * @returns 更新结果
     */
    async updateNickname(updateNicknameValueObject: UpdateNicknameValueObject): GoAsync<void> {
        // 数据校验
        const validateErr = updateNicknameValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return validateErr
        }
        // 更新用户昵称
        return await this.userRepo.updateNickname(updateNicknameValueObject)
    }

    /**
     * 更新用户密码
     * @param updatePasswordValueObject 更新用户密码值对象
     * @returns 更新结果
     */
    async updatePassword(updatePasswordValueObject: UpdatePasswordValueObject): GoAsync<void> {
        // 数据校验
        const validateErr = updatePasswordValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return validateErr
        }
        // 更新用户密码
        return await this.userRepo.updatePassword(updatePasswordValueObject)
    }

    /**
     * 更新用户头像URL
     * @param url 头像URL
     * @returns 更新结果
     */
    async updateAvatarURL(url: string): GoAsync<string> {
        return await this.userRepo.updateAvatarURL(url)
    }

    /**
     * 更新用户头像文件
     * @param file 头像文件
     * @returns 更新结果
     */
    async updateAvatarFile(file: File): GoAsync<string> {
        return await this.userRepo.updateAvatarFile(file)
    }

    /**
     * 获取用户配置
     * @returns 用户配置
     */
    async getConfig(): GoAsync<UserConfigEntity> {
        return await this.userRepo.getConfig()
    }

    /**
     * 更新用户配置
     * @param valueObject 更新用户配置值对象
     * @returns 更新结果
     */
    async updateConfig(valueObject: UpdateUserConfigValueObject): GoAsync<void> {
        const validateErr = valueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return validateErr
        }
        return await this.userRepo.updateConfig(valueObject)
    }
}

