import { SignInValueObject } from '@nao-todo/domain-identity/src/domain/valueobjects/signin'
import { SignUpValueObject } from '@nao-todo/domain-identity/src/domain/valueobjects/signup'

/**
 * 登录表单值
 */
export type SignInFormValues = {
    email: string
    password: string
}

/**
 * 注册表单值
 */
export type SignUpFormValues = {
    email: string
    password: string
    confirmPassword: string
    nickname: string
}

/**
 * 归一化校验错误为字符串
 * @param err 校验错误（Go 风格）
 * @returns 错误字符串或 null
 */
export const toErrorString = (err: string | Error | null): string | null => {
    if (err === null) return null
    return typeof err === 'string' ? err : err.message
}

/**
 * 校验登录表单
 * @description 复用 domain 层 SignInValueObject 的校验语义（邮箱/密码非空、密码格式）
 * @param values 表单值
 * @returns 错误信息或 null
 */
export const validateSignInForm = (values: SignInFormValues): string | null => {
    return toErrorString(new SignInValueObject(values.email, values.password).validate())
}

/**
 * 校验注册表单
 * @description 复用 domain 层 SignUpValueObject 的校验语义（邮箱格式、昵称、密码强度、两次密码一致）
 * @param values 表单值
 * @returns 错误信息或 null
 */
export const validateSignUpForm = (values: SignUpFormValues): string | null => {
    return toErrorString(
        new SignUpValueObject(
            values.email,
            values.password,
            values.confirmPassword,
            values.nickname
        ).validate()
    )
}