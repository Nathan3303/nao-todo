import { AuthDomain, SignInValueObject, SignUpValueObject } from '@nao-todo/domain/auth'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import type { SignInViewObject, SignUpViewObject } from '@nao-todo/types'
import type { GoAsync } from '@nao-todo/types/go'

export interface AuthStore {
    setIsAuthenticated: (isAuthenticated: boolean) => void
    setUserToken: (userToken: string) => void
    clearUserData: () => void
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
     * 创建AuthUseCase实例，自动实例化所有依赖
     * @param authStore 认证存储
     * @returns AuthUseCase实例
     */
    static create(authStore: AuthStore): AuthUseCase {
        const requester = getRequesterImpl()
        const repo = useAuthRepository(requester)
        const domain = new AuthDomain(repo)
        return new AuthUseCase(domain, authStore)
    }

    /**
     * 登录
     * @param vo 登录值对象
     * @returns 错误信息或空值
     */
    async signIn(signInViewObject: SignInViewObject): GoAsync<void> {
        // 视图对象转换为值对象
        const signInValueObject = new SignInValueObject(
            signInViewObject.email,
            signInViewObject.password
        )
        // 2. 调用域服务 - 登录
        const [jwt, err] = await this.authDomain.signIn(signInValueObject)
        if (err !== null) return err
        // 3. 存储JWT
        this.authStore.setIsAuthenticated(true)
        this.authStore.setUserToken(jwt)
        // 4. 返回
        return null
    }

    /**
     * 注册
     * @param vo 注册值对象
     * @returns 错误信息或空值
     */
    async signUp(signUpViewObject: SignUpViewObject): GoAsync<void> {
        // 视图对象转换为值对象
        const signUpValueObject = new SignUpValueObject(
            signUpViewObject.email,
            signUpViewObject.password,
            signUpViewObject.confirmPassword,
            signUpViewObject.nickname
        )
        // 2. 调用域服务 - 注册
        const err = await this.authDomain.signUp(signUpValueObject)
        if (err !== null) return err
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
            localStorage.removeItem('USER_JWT')
            return err
        }
        // 2. 存储JWT
        this.authStore.setIsAuthenticated(true)
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
        // 2. 清除用户数据
        this.authStore.clearUserData()
        // 3. 返回
        return null
    }
}

