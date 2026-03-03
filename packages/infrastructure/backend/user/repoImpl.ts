import SparkMD5 from 'spark-md5'
import type { UserEntity, UserRepository } from '@nao-todo/domain/user'
import type { Go, GoAsync } from '@nao-todo/types'
import type { Requester } from '../../requester/types'
import type { ResponseData } from '../types'
import type { GetUserProfileRes, UpdateAvatarURLRes } from '../types/user'
import { getUserProfileRes2UserEntity } from './converters'

export const useUserRepository = (requester: Requester): UserRepository => {
    /**
     * 更新用户昵称
     * @param newNickname 新昵称
     * @returns 更新结果
     */
    const updateNickname = async (newNickname: string): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put(
            '/user/nickname',
            { nickname: newNickname },
            {
                headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
            }
        )
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10050) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * 获取用户个人信息
     * @returns 用户个人信息
     */
    const getProfile = async (): GoAsync<UserEntity> => {
        // 1. 调用接口
        const response = await requester.get('/user/profile', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10060) {
            return [null, res.message]
        }
        // 3. 转换至实体
        const userEntity = getUserProfileRes2UserEntity(res.data as GetUserProfileRes)
        // 4. 返回
        return [userEntity, null]
    }

    /**
     * 更新用户密码
     * @param oldPassword 旧密码
     * @param newPassword 新密码
     * @returns 更新结果
     */
    const updatePassword = async (oldPassword: string, newPassword: string): GoAsync<void> => {
        // 1. 加密密码
        const [encryptedOldPassword] = encryptPassword(oldPassword)
        const [encryptedNewPassword] = encryptPassword(newPassword)
        // 2. 构建 rto
        const rto = { oldPassword: encryptedOldPassword, newPassword: encryptedNewPassword }
        // 3. 调用接口
        const response = await requester.put('/user/password', rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 4. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10070) return res.message
        // 5. 返回
        return null
    }

    /**
     * 加密密码（md5）
     * @param password 密码
     * @returns 加密后的密码
     */
    const encryptPassword = (password: string): Go<string> => {
        return [SparkMD5.hash(password), null]
    }

    /**
     * 更新用户头像URL
     * @param url 头像URL
     * @returns 更新结果
     */
    const updateAvatarURL = async (url: string): GoAsync<string> => {
        // 1. 调用接口
        const response = await requester.put(
            '/user/avatar',
            { avatarURL: url },
            {
                headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
            }
        )
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10080) {
            return ['', res.message]
        }
        // 3. 返回
        const avatarURL = (res.data as UpdateAvatarURLRes).avatarURL
        return [avatarURL, null]
    }

    /**
     * 停用用户账号
     * @returns 停用结果
     */
    const deactive = async (): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put(
            '/user/deactive',
            {},
            {
                headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
            }
        )
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10090) return res.message
        // 3. 返回
        return null
    }

    /**
     * 激活用户账号
     * @returns 激活结果
     */
    const active = async (): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put(
            '/user/active',
            {},
            {
                headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
            }
        )
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10090) return res.message
        // 3. 返回
        return null
    }

    // @returns
    return {
        updateNickname,
        getProfile,
        updatePassword,
        encryptPassword,
        updateAvatarURL,
        deactive,
        active
    }
}
