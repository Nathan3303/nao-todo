import {
    UpdateUserNicknameValueObject,
    UpdateUserPasswordValueObject,
    UserEntity,
    UserRepository,
    DeactiveUserValueObject,
    RestoreUserValueObject
} from '@nao-todo/domain/user'
import type { GoAsync, Requester } from '@nao-todo/shared'
import type { ResponseData, UserProfileRes, UpdateUserAvatarURLRes } from '../models'
import {
    updateUserNicknameValueObject2Req,
    updateUserPasswordValueObject2Req,
    userProfile2Entity
} from './converters'
import { getJWTFromLocalStorage } from '../utils'

/**
 * 用户仓库实现类
 * @description 用户仓库实现类，包含用户相关操作
 */
export class UserRepoImpl implements UserRepository {
    /**
     * 用户仓库实现类构造函数
     * @param requester 请求器
     */
    constructor(private requester: Requester) {}

    /**
     * 获取用户配置
     * @description 获取用户配置
     * @returns 用户配置
     */
    async getProfile(): GoAsync<UserEntity> {
        // 1. 调用接口
        const response = await this.requester.get('/user/profile', {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10060) {
            return [null, res.message]
        }
        // 3. 返回
        return [userProfile2Entity(res.data as UserProfileRes), null]
    }

    /**
     * 更新用户昵称
     * @description 更新用户昵称
     * @param updateVO 更新昵称值对象
     * @returns 无
     */
    async updateNickname(updateVO: UpdateUserNicknameValueObject): GoAsync<void> {
        // 1. 转换值对象
        const updateRto = updateUserNicknameValueObject2Req(updateVO)
        // 2. 调用接口
        const response = await this.requester.put('/user/nickname', updateRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10050) {
            return res.message
        }
        // 4. 返回
        return null
    }

    /**
     * 更新用户密码
     * @description 更新用户密码
     * @param updateVO 更新密码值对象
     * @returns 无
     */
    async updatePassword(updateVO: UpdateUserPasswordValueObject): GoAsync<void> {
        // 1. 转换值对象
        const updateRto = updateUserPasswordValueObject2Req(updateVO)
        // 3. 调用接口
        const response = await this.requester.put('/user/password', updateRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 4. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10070) return res.message
        // 5. 返回
        return null
    }

    /**
     * 更新用户头像
     * @description 更新用户头像
     * @param url 头像 URL
     * @returns 无
     */
    async updateAvatarURL(url: string): GoAsync<string> {
        // 1. 转换值对象
        const updateRto = { avatarURL: url }
        // 2. 调用接口
        const response = await this.requester.put('/user/avatar', updateRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10080) {
            return [null, res.message]
        }
        // 4. 返回
        return [(res.data as UpdateUserAvatarURLRes).avatarURL, null]
    }

    /**
     * 更新用户头像
     * @description 更新用户头像
     * @param file 头像文件
     * @returns 头像 URL
     */
    async updateAvatarFile(file: File): GoAsync<string> {
        // 1. 构建 FormData
        const formData = new FormData()
        formData.append('avatar', file)
        // 2. 调用接口
        const response = await this.requester.put('/user/avatar', formData, {
            headers: {
                Authorization: `Bearer ${getJWTFromLocalStorage()}`,
                'Content-Type': 'multipart/form-data'
            }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10080) {
            return [null, res.message]
        }
        // 4. 返回
        return [(res.data as UpdateUserAvatarURLRes).avatarURL, null]
    }

    /**
     * 注销用户
     * @description 注销用户
     * @param deactiveVO 注销用户值对象
     * @returns 无
     */
    async deactive(deactiveVO: DeactiveUserValueObject): GoAsync<void> {
        const response = await this.requester.delete('/user/', {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` },
            data: { password: deactiveVO.password }
        })
        const res = response.data as ResponseData
        if (res.code !== 10090) {
            return res.message
        }
        return null
    }

    /**
     * 撤销注销用户
     * @description 撤销注销用户
     * @param restoreVO 撤销注销用户值对象
     * @returns 无
     */
    async restore(restoreVO: RestoreUserValueObject): GoAsync<void> {
        const response = await this.requester.put(
            '/user/restore',
            { password: restoreVO.password },
            {
                headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
            }
        )
        const res = response.data as ResponseData
        if (res.code !== 10090) {
            return res.message
        }
        return null
    }
}

/**
 * 创建用户仓库实例
 * @param requester 请求器
 * @returns 用户仓库实例
 */
export const newUserRepository = (requester: Requester) => {
    return new UserRepoImpl(requester)
}

