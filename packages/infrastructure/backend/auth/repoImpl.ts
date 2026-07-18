import {
    USER_JWT_LOCALSTORAGE_KEY,
    type AuthRepository,
    type SignInValueObject,
    type SignUpValueObject
} from '@nao-todo/domain/auth'
import type { Go, GoAsync, Requester } from '@nao-todo/shared'
import SparkMD5 from 'spark-md5'
import type { CheckInRes, ResponseData, SignInRes } from '../models'
import { signInValueObjectToSignInReq, signUpValueObjectToSignUpReq } from './converters'

export const useAuthRepository = (requester: Requester): AuthRepository => {
    /**
     * 登录
     * @param signInValueObject 登录值对象
     * @returns 登录凭证
     */
    const signIn = async (signInValueObject: SignInValueObject): GoAsync<string> => {
        // 实体转换请求体
        const [rto, err] = signInValueObjectToSignInReq(signInValueObject)
        if (err !== null) return [null, err]
        // 调用登录接口
        const response = await requester.post('/auth/signin', rto)
        const result = response.data as ResponseData
        // 判断是否成功
        if (result.code !== 10010) return [null, result.message]
        // 返回
        const data = result.data as SignInRes
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
     * @param signUpValueObject 注册值对象
     * @returns 错误信息
     */
    const signUp = async (signUpValueObject: SignUpValueObject): GoAsync<void> => {
        // 实体转换请求体
        const [rto, err] = signUpValueObjectToSignUpReq(signUpValueObject)
        if (err !== null) return err
        // 调用注册接口
        const response = await requester.post('/auth/signup', rto)
        const result = response.data as ResponseData
        // 判断是否成功
        if (result.code !== 10000) return result.message
        // 转换为实体
        return null
    }

    /**
     * 检入
     * @param jwt 登录凭证
     * @returns 登录凭证
     */
    const checkIn = async (jwt: string): GoAsync<string> => {
        // 调用接口
        const response = await requester.put('/auth/checkin', { jwt })
        const result = response.data as ResponseData
        // 判断是否成功
        if (result.code !== 10020) return [null, result.message]
        // 返回
        const data = result.data as CheckInRes
        return [data.jwt, null]
    }

    /**
     * 登出
     * @param jwt 登录凭证
     * @returns 错误信息
     */
    const signOut = async (jwt: string): GoAsync<void> => {
        // 调用接口
        const response = await requester.delete('/auth/signout', { jwt })
        const result = response.data as ResponseData
        // 判断是否成功
        if (result.code !== 10031) return result.message
        // 返回
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
