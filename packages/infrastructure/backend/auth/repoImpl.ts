import { UserEntity } from '@nao-todo/domain'
import SparkMD5 from 'spark-md5'
import { userEntity2SignInReq } from './converters'
import type { AuthRepository } from '@nao-todo/domain'
import type { Err, GoLike } from '@nao-todo/types'
import type { CheckInRes, SignInRes, ResponseData } from '../types'
import type { Requester } from '@nao-todo/infrastructure/requester/types'

export const useAuthRepository = (requester: Requester): AuthRepository => {
    // @method 登录
    const signIn = async (userEntity: UserEntity): Promise<GoLike<string>> => {
        // 1. 实体转换请求体
        const rto = userEntity2SignInReq(userEntity)
        // 2. 调用登录接口
        const res = (await requester.post('/auth/signin', rto)).data as ResponseData
        // 3. 判断是否成功
        if (res.code !== 10010) {
            return ['', res.message]
        }
        // 4. 返回
        const data = res.data as SignInRes
        return [data.jwt, null]
    }

    // @method 加密密码（md5）
    const encryptPassword = (password: string): GoLike<string> => {
        return [SparkMD5.hash(password), null]
    }

    // @method 注册
    const signUp = async (userEntity: UserEntity): Promise<Err> => {
        // 1. 实体转换请求体
        const rto = userEntity2SignInReq(userEntity)
        // 2. 调用注册接口
        const response = await requester.post('/auth/signup', rto)
        const res = response.data as ResponseData
        // 3. 判断是否成功
        if (res.code !== 10000) {
            return res.message
        }
        // 4. 转换为实体
        return null
    }

    // @method 检入
    const checkIn = async (jwt: string): Promise<GoLike<string>> => {
        // 1. 调用接口
        const response = await requester.put('/auth/checkin', { jwt })
        const res = response.data as ResponseData
        // 2. 判断是否成功
        if (res.code !== 10020) {
            return ['', res.message]
        }
        // 3. 返回
        const data = res.data as CheckInRes
        return [data.jwt, null]
    }

    // @method 登出
    const signOut = async (jwt: string): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.put('/auth/signout', { jwt })
        const res = response.data as ResponseData
        // 2. 判断是否成功
        if (res.code !== 10031) {
            return res.message
        }
        // 3. 返回
        return null
    }

    // @returns
    return { signIn, encryptPassword, signUp, checkIn, signOut }
}
