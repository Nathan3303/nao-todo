import type { GoAsync } from '@nao-todo/shared'
import type { UserEntity } from '../entities/user'
import type { UpdateUserNicknameValueObject } from '../valueobjects/update-nickname'
import type { UpdateUserPasswordValueObject } from '../valueobjects/update-password'
import type { DeactiveUserValueObject } from '../valueobjects/deactive-user'
import type { RestoreUserValueObject } from '../valueobjects/restore-user'

/**
 * 用户仓库接口
 * @description 用户仓库接口，包含用户相关操作
 */
export interface UserRepository {
    /**
     * 获取用户个人资料
     * @description 获取用户个人资料
     * @returns 用户个人资料
     */
    getProfile(): GoAsync<UserEntity>

    /**
     * 更新用户昵称
     * @description 更新用户昵称
     * @param updateVO 更新昵称值对象
     * @returns 无
     */
    updateNickname(updateVO: UpdateUserNicknameValueObject): GoAsync<void>

    /**
     * 更新用户密码
     * @description 更新用户密码
     * @param updateVO 更新密码值对象
     * @returns 无
     */
    updatePassword(updateVO: UpdateUserPasswordValueObject): GoAsync<void>

    /**
     * 更新用户头像 URL
     * @description 更新用户头像 URL
     * @param url 头像 URL
     * @returns 头像 URL
     */
    updateAvatarURL(url: string): GoAsync<string>

    /**
     * 更新用户头像文件
     * @description 更新用户头像文件
     * @param file 头像文件
     * @returns 头像 URL
     */
    updateAvatarFile(file: File): GoAsync<string>

    /**
     * 注销用户
     * @description 注销用户
     * @param deactiveVO 注销用户值对象
     * @returns 无
     */
    deactive(deactiveVO: DeactiveUserValueObject): GoAsync<void>

    /**
     * 撤销注销用户
     * @description 撤销注销用户
     * @param restoreVO 撤销注销用户值对象
     * @returns 无
     */
    restore(restoreVO: RestoreUserValueObject): GoAsync<void>

    /**
     * 加密用户密码
     * @description 加密用户密码
     * @param password 密码
     * @returns 加密后的密码
     */
    // encryptPassword(password: string): Go<string>
}

