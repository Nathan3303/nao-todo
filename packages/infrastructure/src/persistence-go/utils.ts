import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'

/**
 * JWT token 提供器
 * @description 默认从 localStorage 读取（Web/桌面端行为不变）；
 *              Lynx 等无 localStorage 运行时由应用层注册提供器（如 Mobile 端 storage-core 持有 token）。
 */
type JWTTokenProvider = () => string | null

let tokenProvider: JWTTokenProvider | null = null

/**
 * 注册 JWT token 提供器
 * @description 在应用组合根调用（仅一次）；注册后 getJWTFromLocalStorage 优先走提供器，
 *              未注册时回退 localStorage（Web/桌面端不受影响）。
 * @param provider token 提供器
 */
export const setJWTTokenProvider = (provider: JWTTokenProvider): void => {
    tokenProvider = provider
}

export const getJWTFromLocalStorage = (): string | null => {
    if (tokenProvider !== null) return tokenProvider()
    return localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
}