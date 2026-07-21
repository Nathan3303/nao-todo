import type { SignUpValueObject, SignInValueObject, AuthSessionValueObject } from '../valueobjects'
import type { AuthRepository } from '../repositories'
import type { GoAsync } from '@nao-todo/shared'

/**
 * 认证域
 * @description 认证域，包含登录、注册、检入和登出等功能
 */
export class AuthDomain {
    /**
     * 认证域构造函数
     * @param authRepo 认证仓库
     */
    constructor(private authRepo: AuthRepository) {}

    /**
     * 登录
     * @param signInValueObject 登录值对象
     * @returns 认证会话
     */
    async signIn(signInValueObject: SignInValueObject): GoAsync<AuthSessionValueObject> {
        const validateErr = signInValueObject.validate()
        if (validateErr !== null) {
            return [null, validateErr]
        }
        const [session, signInErr] = await this.authRepo.signIn(signInValueObject)
        if (signInErr !== null) {
            return [null, signInErr]
        }
        this.authRepo.saveJwtToLocalStorage(session.jwt)
        return [session, null]
    }

    /**
     * 注册
     * @param signUpValueObject 注册值对象
     * @returns 错误信息
     */
    async signUp(signUpValueObject: SignUpValueObject): GoAsync<void> {
        // 校验数据
        const validateErr = signUpValueObject.validate()
        if (validateErr !== null) {
            return validateErr
        }
        // 注册
        return await this.authRepo.signUp(signUpValueObject)
    }

    /**
     * 检入
     * @returns 新用户凭据
     */
    async checkIn(): GoAsync<AuthSessionValueObject> {
        // 1. 从本地存储获取登录凭证
        const jwtFromLocalStorage = this.authRepo.getJwtFromLocalStorage()
        if (jwtFromLocalStorage === null) {
            return [null, new Error('未登录')]
        }
        // 2. 检查登录状态
        const [session, err] = await this.authRepo.checkIn(jwtFromLocalStorage)
        // 3. 若检入失败则删除凭据
        if (err !== null) {
            // 3. 移除登录凭证
            this.authRepo.removeJwtFromLocalStorage()
            return [null, err]
        }
        // 4. 若检入成功则保存新凭证
        this.authRepo.saveJwtToLocalStorage(session.jwt)
        // 3. 返回新用户凭据
        return [session, null]
    }

    /**
     * 退出登录
     * @param jwt 登录凭证
     * @returns 错误信息
     */
    async signOut(): GoAsync<void> {
        // 1. 读取本地存储中的登录凭证
        const jwtFromLocalStorage = this.authRepo.getJwtFromLocalStorage()
        if (jwtFromLocalStorage === null) {
            return '未登录'
        }
        // 2. 退出登录
        const err = await this.authRepo.signOut(jwtFromLocalStorage)
        if (err !== null) {
            return err
        }
        // 3. 移除登录凭证
        this.authRepo.removeJwtFromLocalStorage()
        return null
    }
}
