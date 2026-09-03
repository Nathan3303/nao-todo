import type { SignUpValueObject, SignInValueObject, AuthSessionValueObject } from '../valueobjects'
import type { GoAsync } from '@nao-todo/shared'

/**
 * 认证仓库
 */
export interface AuthRepository {
    /**
     * 登录
     * @param signInValueObject 登录值对象
     * @returns 认证会话
     */
    signIn(signInValueObject: SignInValueObject): GoAsync<AuthSessionValueObject>

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
    checkIn(jwt: string): GoAsync<AuthSessionValueObject>

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
    // saveJwtToLocalStorage(jwt: string): Go<void>

    /**
     * 从本地存储获取JWT
     * @returns JWT或null
     */
    // getJwtFromLocalStorage(): string | null

    /**
     * 从本地存储移除JWT
     * @returns 无
     */
    // removeJwtFromLocalStorage(): Go<void>
}