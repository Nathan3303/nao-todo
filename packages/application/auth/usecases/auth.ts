import { AuthDomain } from '@nao-todo/domain/auth'
import type { GoAsync } from '@nao-todo/shared'
import type { AuthStore, SignInViewObject, SignUpViewObject } from '../viewobjects'
import {
    sessionValueObject2ViewObject,
    signInViewObject2ValueObject,
    signUpViewObject2ValueObject
} from './converters'

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
     * @param signInViewObject 登录视图对象
     * @param onPendingDeletion 待注销状态回调
     * @returns 错误信息或空值
     */
    async signIn(signInViewObject: SignInViewObject): GoAsync<void> {
        const signInValueObject = signInViewObject2ValueObject(signInViewObject)
        const [session, err] = await this.authDomain.signIn(signInValueObject)
        if (err !== null) return err
        const sessionViewObject = sessionValueObject2ViewObject(session)
        this.authStore.setIsAuthenticated(true)
        this.authStore.setUserDeletion({
            isPending: sessionViewObject.isPending,
            deadline: sessionViewObject.deadline
        })
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
        const [session, err] = await this.authDomain.checkIn()
        if (err !== null) {
            localStorage.removeItem('USER_JWT')
            return err
        }
        // 存储JWT
        this.authStore.setIsAuthenticated(true)
        // 存储注销截止时间
        const sessionViewObject = sessionValueObject2ViewObject(session)
        this.authStore.setUserDeletion({
            isPending: sessionViewObject.isPending,
            deadline: sessionViewObject.deadline
        })
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
        // 清除认证数据
        this.authStore.clearAuthData()
        // 返回
        return null
    }
}

/**
 * 创建认证用例
 * @param authStore 认证存储
 * @returns 认证用例
 */
// export const newAuthUseCase = (authStore: AuthStore): AuthUseCase => {
//     const requester = getRequesterImpl()
//     const repo = useAuthRepository(requester)
//     const authDomain = new AuthDomain(repo)
//     return new AuthUseCase(authDomain, authStore)
// }
