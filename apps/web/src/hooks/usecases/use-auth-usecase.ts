import { AuthService, AuthStore, AuthUseCase } from '@nao-todo/domain-identity'
import { useAuthRepository } from '@nao-todo/infrastructure/src/persistence-go/identity/auth-repo-impl'
import { getRequesterImpl } from '@nao-todo/shared/requester'
import { useCaseBinding } from '@/hooks/usecases/binding'

/**
 * 认证用例
 * @description 认证仓储两端一致（远程后端）；desktop 端专属的本地数据解锁/会话联动
 *              经 `decorateAuthUseCase` 注入（见 desktop `hooks/usecases/binding.ts`）。
 * @param store 认证状态存储
 * @returns 认证用例
 */
export const useAuthUseCase = (store: AuthStore) => {
    const requester = getRequesterImpl()
    const authRepo = useAuthRepository(requester)
    const authDomain = new AuthService(authRepo)
    const useCase = new AuthUseCase(authDomain, store)
    return useCaseBinding.decorateAuthUseCase?.(useCase) ?? useCase
}