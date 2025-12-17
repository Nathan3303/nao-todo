import type { UserEntity, UserRepository } from '@nao-todo/domain/user'
import type { Err, GoLike } from '@nao-todo/types'
import type { Requester } from '../../requester/types'
import type { ResponseData } from '../types'
import type { GetUserProfileRes, UpdateAvatarURLRes } from '../types/user'
import { getUserProfileRes2UserEntity } from './converters'

export const useUserRepository = (requester: Requester): UserRepository => {
    const updateNickname = async (nickname: string): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.put('/user/nickname', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: { nickname }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10050) {
            return res.message
        }
        // 3. 返回
        return null
    }

    const getProfile = async (): Promise<GoLike<UserEntity | null>> => {
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

    const updatePassword = async (oldPassword: string, newPassword: string): Promise<Err> => {
        // 1. 构建 rto
        const rto = { oldPassword, newPassword }
        // 2. 调用接口
        const response = await requester.put('/user/password', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10070) return res.message
        // 4. 返回
        return null
    }

    const updateAvatarURL = async (url: string): Promise<GoLike<string | null>> => {
        // 1. 调用接口
        const response = await requester.put('/user/avatar', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: { avatarURL: url }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10080) {
            return ['', res.message]
        }
        // 3. 返回
        const avatarURL = (res.data as UpdateAvatarURLRes).avatarURL
        return [avatarURL, null]
    }

    const deactive = async (): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.put('/user/deactive', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10090) return res.message
        // 3. 返回
        return null
    }

    const active = async (): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.put('/user/active', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 10090) return res.message
        // 3. 返回
        return null
    }

    return { updateNickname, getProfile, updatePassword, updateAvatarURL, deactive, active }
}
