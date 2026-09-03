import { AuthService } from '@nao-todo/domain-identity/src/domain/services/auth-service'
import { SignInValueObject } from '@nao-todo/domain-identity/src/domain/valueobjects/signin'
import { SignUpValueObject } from '@nao-todo/domain-identity/src/domain/valueobjects/signup'
import type { AuthSessionValueObject } from '@nao-todo/domain-identity/src/domain/valueobjects/auth-session'
import type {
    AuthStore,
    SignInViewObject,
    SignUpViewObject,
    UserDeletion
} from '@nao-todo/domain-identity/src/application/viewobjects'
import { useAuthRepository } from '@nao-todo/infrastructure/src/persistence-go/identity/auth-repo-impl'
import type { Requester } from '@nao-todo/shared/requester/types'
import { toErrorString } from './auth-form-core'

/**
 * 认证用例接口
 * @description 与 domain-identity 的 AuthUseCase 同构（signIn/signUp/checkIn/signOut → AuthStore 写入）。
 *              不直接复用 AuthUseCase：其 converters 经 domain 聚合间接依赖 shared 聚合（Entity → axios 链），
 *              Lynx 运行时不可用，故在此内联同等逻辑（AuthService/AuthRepository 均为 deep import 复用）。
 */
export type ComposedAuthUseCase = {
    signIn: (signInViewObject: SignInViewObject) => Promise<string | null>
    signUp: (signUpViewObject: SignUpViewObject) => Promise<string | null>
    checkIn: (token: string) => Promise<string | null>
    signOut: (token: string) => Promise<string | null>
}

/**
 * 组装认证用例
 * @description Requester → useAuthRepository → AuthService → ComposedAuthUseCase
 * @param requester 请求器（Lynx 端由 useLynxRequester 创建）
 * @param store 认证存储（实现 AuthStore 接口）
 * @returns 认证用例
 */
export const composeAuthUseCase = (requester: Requester, store: AuthStore): ComposedAuthUseCase => {
    const authRepo = useAuthRepository(requester)
    const authService = new AuthService(authRepo)

    const toUserDeletion = (session: AuthSessionValueObject): UserDeletion => ({
        isPending: session.pendingDeletion,
        deadline: session.deletionDeadline
    })

    return {
        signIn: async (signInViewObject) => {
            const [session, err] = await authService.signIn(
                new SignInValueObject(signInViewObject.email, signInViewObject.password)
            )
            if (err !== null || session === null) return toErrorString(err)
            store.setIsAuthenticated(true)
            store.setUserToken(session.jwt)
            store.setUserDeletion(toUserDeletion(session))
            return null
        },
        signUp: async (signUpViewObject) => {
            const err = await authService.signUp(
                new SignUpValueObject(
                    signUpViewObject.email,
                    signUpViewObject.password,
                    signUpViewObject.confirmPassword,
                    signUpViewObject.nickname
                )
            )
            return toErrorString(err)
        },
        checkIn: async (token) => {
            const [session, err] = await authService.checkIn(token)
            if (err !== null || session === null) {
                store.clearAuthData()
                return toErrorString(err)
            }
            store.setIsAuthenticated(true)
            store.setUserToken(session.jwt)
            store.setUserDeletion(toUserDeletion(session))
            return null
        },
        signOut: async (token) => {
            const err = await authService.signOut(token)
            if (err !== null) return toErrorString(err)
            store.clearAuthData()
            return null
        }
    }
}