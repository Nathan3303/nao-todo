import { AxiosError } from 'axios'

/**
 * 最大重试次数
 */
export const MAX_RETRY = 2

/**
 * 判断错误是否可重试
 * @description 仅当错误码为 'ECONNABORTED'（请求超时）或 'ERR_NETWORK'（网络错误）时可重试
 * @param error 请求错误对象
 * @returns 是否可重试
 */
export const isRetriableError = (error: AxiosError): boolean => {
    return error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK'
}

/**
 * 判断请求方法是否幂等
 * @description method 归一化为小写后 ∈ {get, put, delete} 视为幂等；post 视为非幂等
 * @param method 请求方法
 * @returns 是否幂等
 */
export const isIdempotentMethod = (method?: string): boolean => {
    const normalized = method?.toLowerCase()
    return normalized === 'get' || normalized === 'put' || normalized === 'delete'
}

/**
 * 计算退避延迟
 * @description 指数退避：retryCount 从 0 起算，返回 300 * 2^retryCount（第 1 次 300ms，第 2 次 600ms）
 * @param retryCount 已重试次数
 * @returns 退避延迟（毫秒）
 */
export const getBackoffDelay = (retryCount: number): number => {
    return 300 * 2 ** retryCount
}

/**
 * 延迟指定毫秒数
 * @param ms 延迟毫秒数
 * @returns 延迟完成的 Promise
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}