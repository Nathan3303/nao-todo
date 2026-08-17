import { useEffect, useRef } from 'react'
import type { Requester } from '@nao-todo/shared/requester/types'
import { AuthStoreCore, composeAuthUseCase } from '../logic'
import { loadStoredToken } from '../logic/auth-store-core'
import type { ComposedAuthUseCase } from '../logic/compose-auth-usecase'
import { useAuthStore } from './use-auth-store'

export type UseAuthAppOptions = {
    /**
     * 请求器工厂
     * @description 由应用入口提供（配置层职责）；onAuthExpired 已接好「清空登录态」回调，
     *              工厂把它传给 requester 实现（凭证失效 code 10041 时触发）
     */
    createRequester: (onAuthExpired: () => void) => Requester
}

/**
 * 认证应用 hook（依赖注入唯一入口）
 * @description 按 DDD 架构约定，业务依赖的组装（AuthStoreCore + composeAuthUseCase）与
 *              业务编排（启动 checkIn 恢复登录态、凭证失效清空登录态）收敛于此，
 *              Views 层（App.tsx）只消费返回值并做页面切换。
 * @param options 选项
 * @returns 认证状态与用例
 */
export const useAuthApp = ({ createRequester }: UseAuthAppOptions) => {
    // 单例：认证存储
    const storeRef = useRef<AuthStoreCore | null>(null)
    if (storeRef.current === null) {
        storeRef.current = new AuthStoreCore()
    }
    const store = storeRef.current

    // 单例：认证用例（注入 Requester + Store；凭证失效回调清空登录态）
    const useCaseRef = useRef<ComposedAuthUseCase | null>(null)
    if (useCaseRef.current === null) {
        const requester = createRequester(() => store.clearAuthData())
        useCaseRef.current = composeAuthUseCase(requester, store)
    }
    const authUseCase = useCaseRef.current

    // 认证状态（useSyncExternalStore 响应 store 变化）
    const { isAuthenticated, userToken } = useAuthStore(store)

    // 启动恢复登录态：读取持久化 token 并 checkIn（失败时 usecase 内会清空登录态）
    useEffect(() => {
        void loadStoredToken().then((token) => {
            if (token !== null && token !== '') {
                void authUseCase.checkIn(token)
            }
        })
    }, [authUseCase])

    return {
        store,
        authUseCase,
        isAuthenticated,
        userToken
    }
}