import type {
    AuthRepository,
    SignInValueObject,
    SignUpValueObject,
    AuthSessionValueObject
} from '@nao-todo/domain-identity'
import type { GoAsync, Requester } from '@nao-todo/shared'
import type { CheckInRes, ResponseData, SignInRes } from '../../models'
import {
    signInResToAuthSessionValueObject,
    signInValueObjectToSignInReq,
    signUpValueObjectToSignUpReq
} from './converters'

/**
 * checkin 失败错误（结构化 code 载体，C-67 / r11，DEF-33）
 * @description 仓储边界**必须**透传两类 code（**不改** `GoError` 联合类型）：
 *              - `code`：顶层归一化 code（`requester` 产出的字符串，如 `ERR_NETWORK`）优先；
 *                无顶层 code 时回落为**业务 code**（服务端 `result.code`）。
 *              - `businessCode`：服务端业务 code（如 `10022` / `10051`）。
 *              `message` 与既有用户可见文案逐字一致 ⇒ 分类器以 code 为准、文案仅兜底
 *              （闭合 DEF-25：不再依赖服务端文案）。
 */
type CheckInFailureError = Error & { code?: string | number; businessCode?: number }

/** 构造 checkin 失败错误（透传顶层归一化 code + 业务 code，C-67） */
const createCheckInFailureError = (
    response: unknown,
    result: ResponseData | null
): CheckInFailureError => {
    const error = new Error(result?.message ?? '请求失败') as CheckInFailureError
    const normalizedCode = (response as { code?: unknown } | null | undefined)?.code
    const businessCode = typeof result?.code === 'number' ? result.code : undefined
    if (typeof normalizedCode === 'string' || typeof normalizedCode === 'number') {
        error.code = normalizedCode
    } else if (businessCode !== undefined) {
        error.code = businessCode
    }
    if (businessCode !== undefined) error.businessCode = businessCode
    return error
}

export const useAuthRepository = (requester: Requester): AuthRepository => {
    /**
     * 登录
     * @param signInValueObject 登录值对象
     * @returns 认证会话
     */
    const signIn = async (
        signInValueObject: SignInValueObject
    ): GoAsync<AuthSessionValueObject> => {
        const [rto, err] = signInValueObjectToSignInReq(signInValueObject)
        if (err !== null) return [null, err]
        const response = await requester.post('/auth/signin', rto)
        const result = response.data as ResponseData | null
        if (result === null || result.code !== 10010) {
            return [null, result?.message ?? '请求失败']
        }
        const data = result.data as SignInRes
        return [signInResToAuthSessionValueObject(data), null]
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
        const result = response.data as ResponseData | null
        // 判断是否成功
        if (result === null || result.code !== 10000) return result?.message ?? '请求失败'
        // 转换为实体
        return null
    }

    /**
     * 检入
     * @param jwt 登录凭证
     * @returns 登录凭证
     */
    const checkIn = async (jwt: string): GoAsync<AuthSessionValueObject> => {
        // 调用接口
        const response = await requester.put('/auth/checkin', { jwt })
        const result = response.data as ResponseData | null
        // 判断是否成功
        if (result === null || result.code !== 10020) {
            // C-67：失败以 Error 携带结构化 code 返回（用户可见文案不变）
            return [null, createCheckInFailureError(response, result)]
        }
        // 返回
        const data = result.data as CheckInRes
        return [signInResToAuthSessionValueObject(data), null]
    }

    /**
     * 登出
     * @param jwt 登录凭证
     * @returns 错误信息
     */
    const signOut = async (jwt: string): GoAsync<void> => {
        // 调用接口
        // 注意：delete 的请求体需放在 config.data 中（Requester.delete(url, config) 契约），
        //       否则 axios（config.data）与 lynx（config.data）两端都不会携带 body
        const response = await requester.delete('/auth/signout', { data: { token: jwt } })
        const result = response.data as ResponseData | null
        // 判断是否成功
        if (result === null || result.code !== 10031) return result?.message ?? '请求失败'
        // 返回
        return null
    }

    // @returns
    return {
        signIn,
        signUp,
        checkIn,
        signOut
    }
}