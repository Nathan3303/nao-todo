import type { GoAsync } from '@nao-todo/shared/types'
import type { AuthService } from '../../../domain'
import type { AuthStore, SignInViewObject, SignUpViewObject } from '../../viewobjects'
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
     * @param authService 认证服务
     * @param authStore 认证存储
     */
    constructor(
        private authService: AuthService,
        private authStore: AuthStore
    ) {}

    /**
     * 登录
     * @param signInViewObject 登录视图对象
     * @returns 错误信息或空值
     */
    async signIn(signInViewObject: SignInViewObject): GoAsync<void> {
        const [authSession, signInError] = await this.authService.signIn(
            signInViewObject2ValueObject(signInViewObject)
        )
        if (signInError !== null) {
            return signInError
        }
        const sessionViewObject = sessionValueObject2ViewObject(authSession)
        this.authStore.setIsAuthenticated(true)
        this.authStore.setUserToken(sessionViewObject.token)
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
        const signUpError = await this.authService.signUp(
            signUpViewObject2ValueObject(signUpViewObject)
        )
        if (signUpError !== null) {
            return signUpError
        }
        return null
    }

    /**
     * 检查登录状态
     * @param token 用户凭据
     * @returns 错误信息或空值
     */
    async checkIn(token: string): GoAsync<void> {
        const [authSession, checkInError] = await this.authService.checkIn(token)
        if (checkInError !== null) {
            this.authStore.clearAuthData()
            return checkInError
        }
        const sessionViewObject = sessionValueObject2ViewObject(authSession)
        this.authStore.setIsAuthenticated(true)
        this.authStore.setUserToken(authSession.jwt)
        this.authStore.setUserDeletion({
            isPending: sessionViewObject.isPending,
            deadline: sessionViewObject.deadline
        })
        return null
    }

    /**
     * 退出登录
     * @param token 用户凭据
     * @returns 错误信息或空值
     */
    async signOut(token: string): GoAsync<void> {
        const signOutError = await this.authService.signOut(token)
        if (signOutError !== null) {
            return signOutError
        }
        this.authStore.clearAuthData()
        return null
    }
}