import { AuthDomain } from '@nao-todo/domain/auth'
import type { AuthStore } from './store'
import type { SignInViewObject, SignUpViewObject } from './viewobjects'
import type { GoAsync } from '@nao-todo/types'
import { signInViewObject2ValueObject, signUpViewObject2ValueObject } from './converters'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'

/**
 * 认证用例
 * @description 认证用例类，用于处理认证相关的业务逻辑。
 */
export class AuthUseCase {
    /**
     * 认证用例构造函数
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
    async signIn(signInViewObject: SignInViewObject): GoAsync<void> {
        // 视图对象转换为值对象
        const signInValueObject = signInViewObject2ValueObject(signInViewObject)
        // 调用域服务 - 登录
        const [jwt, err] = await this.authDomain.signIn(signInValueObject)
        if (err !== null) return err
        // 存储JWT
        this.authStore.setIsAuthenticated(true)
        this.authStore.setUserToken(jwt)
        // 返回
        return null
    }

    /**
     * 注册
     * @param signUpViewObject 注册视图对象
     * @returns 错误信息或空值
     */
    async signUp(signUpViewObject: SignUpViewObject): GoAsync<void> {
        // 视图对象转换为值对象
        const signUpValueObject = signUpViewObject2ValueObject(signUpViewObject)
        // 调用域服务 - 注册
        const err = await this.authDomain.signUp(signUpValueObject)
        if (err !== null) return err
        // 返回
        return null
    }

    /**
     * 检查登录状态
     * @returns 错误信息或空值
     */
    async checkIn(): GoAsync<void> {
        // 调用域服务 - 检查登录状态
        const [newJwt, err] = await this.authDomain.checkIn()
        if (err !== null) {
            localStorage.removeItem('USER_JWT')
            return err
        }
        // 存储JWT
        this.authStore.setIsAuthenticated(true)
        this.authStore.setUserToken(newJwt)
        // 返回
        return null
    }

    /**
     * 退出登录
     * @returns 错误信息或空值
     */
    async signOut(): GoAsync<void> {
        // 调用域服务 - 退出登录
        const err = await this.authDomain.signOut()
        if (err !== null) {
            return err
        }
        // 清除用户数据
        this.authStore.clearUserData()
        // 返回
        return null
    }
}

/**
 * 创建认证用例
 * @param authStore 认证存储
 * @returns 认证用例
 */
export const newAuthUseCase = (authStore: AuthStore): AuthUseCase => {
    const requester = getRequesterImpl()
    const repo = useAuthRepository(requester)
    const authDomain = new AuthDomain(repo)
    return new AuthUseCase(authDomain, authStore)
}

