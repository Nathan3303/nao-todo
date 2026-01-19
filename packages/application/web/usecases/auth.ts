import { AuthDomain, type SignUpValueObject, type SignInValueObject } from '@nao-todo/domain/auth'
import { USER_PASSWORD_REGEXP } from '@nao-todo/infrastructure/consts/auth'
import type { GoAsync } from '@nao-todo/types/go'

export interface AuthStore {
    setUserToken: (userToken: string) => void
}

export class AuthUseCase {
    /**
     * 认证用例
     * @param authDomain 认证领域
     * @param authStore 认证存储
     */
    constructor(
        private authDomain: AuthDomain,
        private authStore: AuthStore
    ) {}

    /**
     * 登录
     * @param vo 登录值对象
     * @returns 错误信息或空值
     */
    async signIn(vo: SignInValueObject): GoAsync<void> {
        // 1. 检查属性值
        if (vo.email === '') return '请输入邮箱'
        if (vo.password === '') return '请输入密码'
        // 2. 调用域服务 - 登录
        const [jwt, err] = await this.authDomain.signIn(vo)
        if (err !== null) {
            return err
        }
        // 3. 存储JWT
        this.authStore.setUserToken(jwt)
        // 4. 返回
        return null
    }

    /**
     * 注册
     * @param vo 注册值对象
     * @returns 错误信息或空值
     */
    async signUp(vo: SignUpValueObject): GoAsync<void> {
        // 1. 检查属性值
        if (vo.email === '') return '请输入邮箱'
        if (vo.password === '') return '请输入密码'
        if (vo.confirmPassword === '') return '请确认密码'
        if (vo.password !== vo.confirmPassword) return '两次密码不一致'
        // 2. 检查密码格式
        if (vo.password.length < 8 || vo.password.length > 24) {
            return '密码格式有误，需要 8 至 24 位的长度'
        }
        if (
            !USER_PASSWORD_REGEXP.test(vo.password) ||
            !USER_PASSWORD_REGEXP.test(vo.confirmPassword)
        ) {
            return '密码格式错误'
        }
        // 2. 调用域服务 - 注册
        const err = await this.authDomain.signUp(vo)
        if (err !== null) {
            return err
        }
        // 3. 返回
        return null
    }

    /**
     * 检查登录状态
     * @returns 错误信息或空值
     */
    async checkIn(): GoAsync<void> {
        // 1. 调用域服务 - 检查登录状态
        const [newJwt, err] = await this.authDomain.checkIn()
        if (err !== null) {
            return err
        }
        // 2. 存储JWT
        this.authStore.setUserToken(newJwt)
        // 3. 返回
        return null
    }

    /**
     * 退出登录
     * @returns 错误信息或空值
     */
    async signOut(): GoAsync<void> {
        // 1. 调用域服务 - 退出登录
        const err = await this.authDomain.signOut()
        if (err !== null) {
            return err
        }
        // 2. 清除JWT
        this.authStore.setUserToken('')
        // 3. 返回
        return null
    }
}
