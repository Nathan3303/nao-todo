import { setJWTTokenProvider } from '@nao-todo/infrastructure/src/persistence-go/utils'

/**
 * Lynx 运行时 JWT 令牌持有器
 * @description Lynx 无 localStorage：登录/checkIn 成功后将 token 写入本持有器，并注册为
 *              infrastructure 的 token 提供器（persistence-go 仓储统一经 getJWTFromLocalStorage 取 token）；
 *              登出/凭证失效时清空。Web/桌面端未注册提供器，仍走 localStorage，行为不变。
 */
let currentToken = ''

/** 写入并注册 token（登录/checkIn 成功后调用） */
export const setAuthToken = (token: string): void => {
    currentToken = token
    setJWTTokenProvider(() => currentToken || null)
}

/** 清空 token（登出/凭证失效时调用） */
export const clearAuthToken = (): void => {
    currentToken = ''
}

/** 读取当前 token（供 requester/调试使用） */
export const getAuthToken = (): string => currentToken