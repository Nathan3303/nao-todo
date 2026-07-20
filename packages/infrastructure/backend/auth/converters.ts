import { SignInValueObject, SignUpValueObject } from '@nao-todo/domain/auth'
import { unwrapError, type Go } from '@nao-todo/shared'
import type { SignInReq, SignUpReq } from '../models/auth'

/**
 * 登录值对象转换为登录请求体
 * @param signInValueObject 登录值对象
 * @returns 登录请求体和错误信息
 */
export const signInValueObjectToSignInReq = (
    signInValueObject: SignInValueObject
): Go<SignInReq> => {
    // 获取加密密码
    const [encryptedPassword, err] = signInValueObject.getEncryptedPassword()
    if (err !== null) {
        console.error(unwrapError(err))
        return [null, err]
    }
    // 返回
    return [
        {
            email: signInValueObject.email,
            password: encryptedPassword
        },
        null
    ]
}

/**
 * 注册值对象转换为注册请求体
 * @param signUpValueObject 注册值对象
 * @returns 注册请求体和错误信息
 */
export const signUpValueObjectToSignUpReq = (
    signUpValueObject: SignUpValueObject
): Go<SignUpReq> => {
    // 获取加密密码
    const [encryptedPassword, err] = signUpValueObject.getEncryptedPassword()
    if (err !== null) {
        console.error(unwrapError(err))
        return [null, err]
    }
    // 返回
    return [
        {
            email: signUpValueObject.email,
            password: encryptedPassword,
            nickname: signUpValueObject.nickname
        },
        null
    ]
}
