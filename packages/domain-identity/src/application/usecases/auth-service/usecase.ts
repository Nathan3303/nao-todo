import type { GoAsync } from '@nao-todo/shared/types'
import type { AuthService } from '../../../domain'
import type { AuthStore, SignInViewObject, SignUpViewObject } from '../../viewobjects'
import {
    sessionValueObject2ViewObject,
    signInViewObject2ValueObject,
    signUpViewObject2ValueObject
} from './converters'
import { isCredentialError } from './error-classification'
import { recordCheckInAttempt } from '@nao-todo/shared/session-renewal'

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
        // Issue #260 修复①：登录成功即记录 checkin 发起时刻 —— 必须在 `setUserToken` **之前**：
        // store watch 的微任务先于本用例续体执行，晚于 setUserToken 才记录 ⇒ 桌面续期调度器
        // `start()` 的同步段读到 null ⇒ 立即用旧 token 补发 checkin ⇒ 服务端轮换 ⇒
        // 在途 pull/Epoch/导航请求拿 10041 ⇒ 被登出 ⇒ 「登录成功但卡在登录页」。
        recordCheckInAttempt()
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
            // 失败分流（DEF-5 / AC7）：仅凭证类失败清认证；网络类/未知失败保留 JWT 与设备标识，允许重试
            if (isCredentialError(checkInError)) {
                this.authStore.clearAuthData()
            }
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