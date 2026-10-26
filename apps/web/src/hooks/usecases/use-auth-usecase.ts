import { AuthService, AuthStore, AuthUseCase } from '@nao-todo/domain-identity'
import { useAuthRepository } from '@nao-todo/infrastructure/src/persistence-go/identity/auth-repo-impl'
import { getRequesterImpl } from '@nao-todo/shared/requester'
import { recordShellError } from '@/error-observability'
import { useCaseBinding } from '@/hooks/usecases/binding'

/**
 * 检入冲突事件 → 结构化可观测（SHELL-05 同一通道 / `__NAO_ERROR_LOG__`）
 * @description 域层只出事件、不依赖端侧实现（可选上报器端口）：web/桌面在此接入。
 *              payload 只含 `code` / `phase` / `reason` / `outcome` / token **前缀**（⛔ 无完整 token）。
 */
const reportCheckInConflict = (event: {
    code: number
    phase: string
    snapshot: string
    reason?: string
    outcome?: string
}): void => {
    const fields = [`code=${event.code}`, `phase=${event.phase}`]
    if (event.reason) fields.push(`reason=${event.reason}`)
    if (event.outcome) fields.push(`outcome=${event.outcome}`)
    fields.push(`snapshot=${event.snapshot}`)
    recordShellError('auth:checkin-conflict', fields.join(' '))
}

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
    const useCase = new AuthUseCase(authDomain, store, reportCheckInConflict)
    return useCaseBinding.decorateAuthUseCase?.(useCase) ?? useCase
}