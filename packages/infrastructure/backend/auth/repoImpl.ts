import SparkMD5 from 'spark-md5'
import { userEntity2SignInReq } from './converters'
import type { SignUpValueObject, SignInValueObject } from '@nao-todo/domain/auth'
import type { AuthRepository } from '@nao-todo/domain'
import type { Go, GoAsync } from '@nao-todo/types'
import type { CheckInRes, SignInRes, ResponseData } from '../types'
import type { Requester } from '@nao-todo/infrastructure/requester/types'
import { USER_JWT_LOCALSTORAGE_KEY } from '../../consts/auth'

export const useAuthRepository = (requester: Requester): AuthRepository => {
    /**
     * 登录
     * @param vo 登录值对象
     * @returns 登录凭证
     */
    const signIn = async (vo: SignInValueObject): GoAsync<string> => {
        // 1. 实体转换请求体
        const rto = userEntity2SignInReq(vo)
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

    /**
     * 加密密码（md5）
     * @param password 密码
     * @returns 加密后的密码
     */
    const encryptPassword = (password: string): Go<string> => {
        return [SparkMD5.hash(password), null]
    }

    /**
     * 注册
     * @param vo 注册值对象
     * @returns 错误信息
     */
    const signUp = async (vo: SignUpValueObject): GoAsync<void> => {
        // 1. 实体转换请求体
        const rto = userEntity2SignInReq(vo)
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

    /**
     * 检入
     * @param jwt 登录凭证
     * @returns 登录凭证
     */
    const checkIn = async (jwt: string): GoAsync<string> => {
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

    /**
     * 登出
     * @param jwt 登录凭证
     * @returns 错误信息
     */
    const signOut = async (jwt: string): GoAsync<void> => {
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

    /**
     * 保存登录凭证
     * @param jwt 登录凭证
     */
    const saveJwtToLocalStorage = (jwt: string): Go<void> => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, jwt)
        return null
    }

    /**
     * 获取登录凭证
     * @returns 登录凭证
     */
    const getJwtFromLocalStorage = (): string | null => {
        return localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
    }

    /**
     * 移除登录凭证
     */
    const removeJwtFromLocalStorage = (): Go<void> => {
        localStorage.removeItem(USER_JWT_LOCALSTORAGE_KEY)
        return null
    }

    // @returns
    return {
        signIn,
        encryptPassword,
        signUp,
        checkIn,
        signOut,
        saveJwtToLocalStorage,
        getJwtFromLocalStorage,
        removeJwtFromLocalStorage
    }
}
