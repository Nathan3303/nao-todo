import { UserUseCase } from '@nao-todo/domain-identity'
import { UserRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/identity/user-repo-impl/impl'
import { UserConfigRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/identity/user-config-repo-impl/impl'
import type { Requester } from '@nao-todo/shared/requester/types'
import type { AuthStoreCore } from './auth-store-core'

/**
 * 用户用例接口（组合后的门面）
 */
export type ComposedUserUseCase = {
    loadUserProfile: () => ReturnType<UserUseCase['loadUserProfile']>
}

/**
 * 组装用户用例
 * @description Requester → UserRepoImpl/UserConfigRepoImpl → UserUseCase
 *              （UserStore 由 AuthStoreCore 实现——AuthStore 为 UserStore 子集）
 * @param requester 请求器
 * @param store 认证/用户存储（实现 UserStore）
 * @returns 用户用例门面
 */
export const composeUserUseCase = (
    requester: Requester,
    store: AuthStoreCore
): ComposedUserUseCase => {
    const userRepo = new UserRepoImpl(requester)
    const userConfigRepo = new UserConfigRepoImpl(requester)
    const userUseCase = new UserUseCase(userRepo, userConfigRepo, store)

    return {
        loadUserProfile: () => userUseCase.loadUserProfile()
    }
}