import {
    UpdateNicknameValueObject,
    UpdatePasswordValueObject,
    UpdateUserConfigValueObject,
    UserConfigEntity,
    UserEntity,
    type UserRepository
} from '@nao-todo/domain/user'
import type { Go, GoAsync } from '@nao-todo/types'
import SparkMD5 from 'spark-md5'
import type { Requester } from '../../requester/types'
import type { ResponseData } from '../types'
import type { GetUserConfigRes, GetUserProfileRes, UpdateAvatarURLRes } from '../types/user'
import { getUserConfigResToEntity, getUserProfileRes2UserEntity } from './converters'

/**
 * 用户仓库实现
 * @description 用户仓库实现类，用于表示用户的业务逻辑和数据存储。
 * @param requester 请求器
 * @returns 用户仓库
 */
export const useUserRepository = (requester: Requester): UserRepository => {
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
        if (res.code !== 10060) return [null, res.message]
        // 3. 转换至实体
        const userEntity = getUserProfileRes2UserEntity(res.data as GetUserProfileRes)
        // 4. 返回
        return [userEntity, null]
    }

    /**
     * 更新用户昵称
     * @param updateNicknameValueObject 更新昵称值对象
     * @returns 更新结果
     */
    const updateNickname = async (
        updateNicknameValueObject: UpdateNicknameValueObject
    ): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put(
            '/user/nickname',
            { nickname: updateNicknameValueObject.nickname },
            {
                headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
            }
        )
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10050) return res.message
        // 3. 返回
        return null
    }

    /**
     * 更新用户密码
     * @param updatePasswordValueObject 更新密码值对象
     * @returns 更新结果
     */
    const updatePassword = async (
        updatePasswordValueObject: UpdatePasswordValueObject
    ): GoAsync<void> => {
        // 1. 加密密码
        const [encryptedOldPassword] = encryptPassword(updatePasswordValueObject.oldPassword)
        const [encryptedNewPassword] = encryptPassword(updatePasswordValueObject.newPassword)
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
        if (res.code !== 10080) return ['', res.message]
        // 3. 返回
        const avatarURL = (res.data as UpdateAvatarURLRes).avatarURL
        return [avatarURL, null]
    }

    /**
     * 更新用户头像文件
     * @param file 头像文件
     * @returns 更新结果
     */
    const updateAvatarFile = async (file: File): GoAsync<string> => {
        // 1. 构建 FormData
        const formData = new FormData()
        formData.append('avatar', file)
        console.log('updateAvatarFile: uploading file', {
            name: file.name,
            size: file.size,
            type: file.type
        })
        // 2. 调用接口
        const response = await requester.put('/user/avatar', formData, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('USER_JWT')}`,
                'Content-Type': 'multipart/form-data'
            }
        })
        console.log('updateAvatarFile: response', response)
        // 3. 判断结果
        const res = response.data as ResponseData
        console.log('updateAvatarFile: response data', res)
        if (res.code !== 10080) return ['', res.message]
        // 4. 返回
        const data = res.data as any
        const avatarURL = data.avatarURL || data.avatar || ''
        console.log('updateAvatarFile: avatarURL', avatarURL)
        return [avatarURL, null]
    }

    /**
     * 停用用户账号
     * @returns 停用结果
     */
    const deactive = async (): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put('/user/deactive', null, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
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
        const response = await requester.put('/user/active', null, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10090) return res.message
        // 3. 返回
        return null
    }

    /**
     * 获取用户配置
     * @returns 用户配置
     */
    const getConfig = async (): GoAsync<UserConfigEntity> => {
        const response = await requester.get('/user/config', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        const res = response.data as ResponseData
        if (res.code !== 10110) return [null, res.message]
        const data = res.data as GetUserConfigRes
        const userConfigEntity = getUserConfigResToEntity(data)
        return [userConfigEntity, null]
    }

    /**
     * 更新用户配置
     * @param valueObject 更新用户配置值对象
     * @returns 更新结果
     */
    const updateConfig = async (valueObject: UpdateUserConfigValueObject): GoAsync<void> => {
        const response = await requester.put(
            '/user/config',
            { appearance: valueObject.appearance },
            {
                headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
            }
        )
        const res = response.data as ResponseData
        if (res.code !== 10120) return res.message
        return null
    }

    /**
     * 加密密码（md5）
     * @param password 密码
     * @returns 加密后的密码
     */
    const encryptPassword = (password: string): Go<string> => [SparkMD5.hash(password), null]

    // @returns
    return {
        updateNickname,
        getProfile,
        updatePassword,
        encryptPassword,
        updateAvatarURL,
        updateAvatarFile,
        deactive,
        active,
        getConfig,
        updateConfig
    }
}

