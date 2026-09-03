import { AuthSessionValueObject } from '@nao-todo/domain-identity/src/domain/valueobjects/auth-session'
import { SignInValueObject } from '@nao-todo/domain-identity/src/domain/valueobjects/signin'
import { SignUpValueObject } from '@nao-todo/domain-identity/src/domain/valueobjects/signup'
import type { Go } from '@nao-todo/shared'
import type { SignInReq, SignInRes, SignUpReq } from '../../models/auth'

/**
 * 登录值对象转换为登录请求
 * @param signInValueObject 登录值对象
 * @returns 登录请求
 */
export const signInValueObjectToSignInReq = (
    signInValueObject: SignInValueObject
): Go<SignInReq> => {
    return [{ email: signInValueObject.email, password: signInValueObject.password }, null]
}

/**
 * 登录响应转换为认证会话值对象
 * @param signInRes 登录响应
 * @returns 认证会话值对象
 */
export const signInResToAuthSessionValueObject = (signInRes: SignInRes): AuthSessionValueObject => {
    return new AuthSessionValueObject(signInRes.jwt, signInRes.pendingDeletion, signInRes.deletedAt)
}

/**
 * 注册值对象转换为注册请求
 * @param signUpValueObject 注册值对象
 * @returns 注册请求
 */
export const signUpValueObjectToSignUpReq = (
    signUpValueObject: SignUpValueObject
): Go<SignUpReq> => {
    return [
        {
            email: signUpValueObject.email,
            password: signUpValueObject.password,
            nickname: signUpValueObject.nickname
        },
        null
    ]
}