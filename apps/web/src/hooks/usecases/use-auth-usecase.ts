import { AuthService, AuthStore, AuthUseCase } from '@nao-todo/domain-identity'
import { useAuthRepository } from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 认证用例
 * @param store 认证状态存储
 * @returns 认证用例
 */
export const useAuthUseCase = (store: AuthStore) => {
    const requester = getRequesterImpl()
    const authRepo = useAuthRepository(requester)
    const authDomain = new AuthService(authRepo)
    return new AuthUseCase(authDomain, store)
}