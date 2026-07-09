import type { SignUpValueObject } from './valueobjects/signup'
import type { SignInValueObject } from './valueobjects/signin'
import type { Go, GoAsync } from '@nao-todo/types'

/**
 * 认证仓库
 */
export interface AuthRepository {
    /**
     * 登录
     * @param signInValueObject 登录值对象
     * @returns JWT
     */
    signIn(signInValueObject: SignInValueObject): GoAsync<string>

    /**
     * 加密密码
     * @param password 密码
     * @returns 加密后的密码
     */
    encryptPassword(password: string): Go<string>

    /**
     * 注册
     * @param signUpValueObject 注册值对象
     * @returns 无
     */
    signUp(signUpValueObject: SignUpValueObject): GoAsync<void>

    /**
     * 检查登录
     * @param jwt JWT
     * @returns 用户ID
     */
    checkIn(jwt: string): GoAsync<string>

    /**
     * 退出登录
     * @param jwt JWT
     * @returns 无
     */
    signOut(jwt: string): GoAsync<void>

    /**
     * 保存JWT到本地存储
     * @param jwt JWT
     * @returns 无
     */
    saveJwtToLocalStorage(jwt: string): Go<void>

    /**
     * 从本地存储获取JWT
     * @returns JWT或null
     */
    getJwtFromLocalStorage(): string | null

    /**
     * 从本地存储移除JWT
     * @returns 无
     */
    removeJwtFromLocalStorage(): Go<void>
}

