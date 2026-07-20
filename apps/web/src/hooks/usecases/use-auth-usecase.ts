import { AuthDomain, AuthStore } from '@nao-todo/domain/auth'
import { getRequesterImpl } from '@nao-todo/shared'
import { useAuthRepository } from '@nao-todo/infrastructure/backend'
import { AuthUseCase } from '@nao-todo/application/auth/usecases'

/**
 * 认证用例
 * @param store 认证状态存储
 * @returns 认证用例
 */
export const useAuthUseCase = (store: AuthStore) => {
    const requester = getRequesterImpl()
    const authRepo = useAuthRepository(requester)
    const authDomain = new AuthDomain(authRepo)
    return new AuthUseCase(authDomain, store)
}

