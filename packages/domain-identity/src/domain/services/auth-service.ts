import type { GoAsync } from '@nao-todo/shared/types'
import type { SignUpValueObject, SignInValueObject, AuthSessionValueObject } from '../valueobjects'
import type { AuthRepository } from '../repositories'

/**
 * 认证服务
 * @description 认证服务，包含登录、注册、检入和登出等功能
 */
export class AuthService {
    /**
     * 认证服务构造函数
     * @param authRepo 认证仓库
     */
    constructor(private authRepo: AuthRepository) {}

    /**
     * 登录
     * @param signInValueObject 登录值对象
     * @returns 认证会话
     */
    async signIn(signInValueObject: SignInValueObject): GoAsync<AuthSessionValueObject> {
        const validateError = signInValueObject.validate()
        if (validateError !== null) {
            return [null, validateError]
        }
        return await this.authRepo.signIn(signInValueObject)
    }

    /**
     * 注册
     * @param signUpValueObject 注册值对象
     * @returns 错误信息
     */
    async signUp(signUpValueObject: SignUpValueObject): GoAsync<void> {
        const validateErr = signUpValueObject.validate()
        if (validateErr !== null) {
            return validateErr
        }
        return await this.authRepo.signUp(signUpValueObject)
    }

    /**
     * 检入
     * @param token 用户凭据
     * @returns 会话信息 + 错误
     */
    async checkIn(token: string): GoAsync<AuthSessionValueObject> {
        return await this.authRepo.checkIn(token)
    }

    /**
     * 退出登录
     * @param token 用户凭据
     * @returns 错误信息
     */
    async signOut(token: string): GoAsync<void> {
        return await this.authRepo.signOut(token)
    }
}