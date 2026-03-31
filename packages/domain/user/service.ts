import type { GoAsync } from '@nao-todo/types'
import type { UserRepository } from './repositories'
import { UserEntity } from './entities'
import { UpdateNicknameValueObject, UpdatePasswordValueObject } from './valueobjects'
import { unwrapError } from '@nao-todo/infrastructure/utils'

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
}
