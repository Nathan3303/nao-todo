import Axios from 'axios' // type InternalAxiosRequestConfig // AxiosError
import type { HttpMethod, Requester } from './types'
import { createLog, markFailed, removeLog } from './operation-log'
import {
    MAX_RETRY,
    delay,
    getBackoffDelay,
    isIdempotentMethod,
    isRetriableError
} from './retry'

/**
 * 创建 Axios 请求器
 * @param baseURL 基础 URL
 * @param enableRetry 是否开启幂等请求自动重试（默认开启）
 * @returns Axios 请求器
 */
export default (baseURL: string, enableRetry = true): Requester => {
    /**
     * 创建 Axios 实例
     */
    const axiosInstance = Axios.create({
        baseURL,
        timeout: 5000,
        withCredentials: true,
        headers: {
            'Content-Type': 'application/json; charset=UTF-8'
        }
    })

    /**
     * 添加响应拦截器
     * @description 对幂等请求的网络错误自动重试；重试耗尽或关闭时归一化错误响应
     */
    axiosInstance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const config = error.config || {}

            // 幂等请求的网络/超时错误自动重试（受 enableRetry 开关控制）
            if (
                enableRetry &&
                isRetriableError(error) &&
                isIdempotentMethod(config.method)
            ) {
                config._retryCount = config._retryCount || 0
                if (config._retryCount < MAX_RETRY) {
                    config._retryCount += 1
                    await delay(getBackoffDelay(config._retryCount - 1))
                    return axiosInstance(config)
                }
            }

            const retryCount = config._retryCount || 0

            switch (error.code) {
                // 处理请求过于频繁的错误
                case 'TOO_MANY_REQUESTS':
                    return Promise.resolve({
                        code: error.code,
                        _retryCount: retryCount,
                        data: {
                            data: null,
                            message: '请求过于频繁，请稍后再试',
                            code: 42900
                        }
                    })
                // 处理请求超时的错误
                case 'ECONNABORTED':
                    return Promise.resolve({
                        code: error.code,
                        _retryCount: retryCount,
                        data: {
                            data: null,
                            message: '请求超时，请稍后再试',
                            code: 40800
                        }
                    })
                // 处理网络错误
                case 'ERR_NETWORK':
                    return Promise.resolve({
                        code: error.code,
                        _retryCount: retryCount,
                        data: {
                            data: null,
                            message: '网络错误，请检查您的网络连接',
                            code: 50300
                        }
                    })
                // 处理其他错误
                default:
                    console.error(error)
                    return Promise.reject(error)
            }
        }
    )

    /**
     * 判断响应是否为归一化的网络错误
     * @description 归一化错误在顶层携带字符串 code（如 'ERR_NETWORK'）
     * @param response 响应对象
     * @returns 是否为归一化网络错误
     */
    const isNormalizedError = (response: any): boolean => typeof response?.code === 'string'

    /**
     * 为请求方法包装操作日志能力
     * @description 请求前记录 pending 日志；成功后删除；最终失败标记为 failed。
     *              日志写/删均为异步且不阻塞主请求流程。
     * @param method 请求方法
     * @param fn 底层 Axios 请求方法
     * @param hasData 是否携带请求体（用于定位 data 参数）
     */
    const withLog = <T extends (...args: any[]) => Promise<any>>(
        method: HttpMethod,
        fn: T,
        hasData: boolean
    ): T => {
        return (async (...args: any[]) => {
            const url = args[0] as string
            const data = hasData ? args[1] : undefined
            // 不阻塞请求：日志写入与主请求并行
            const logIdPromise = createLog(method, url, data)
            try {
                const response = await fn(...args)
                logIdPromise.then((logId) => {
                    if (isNormalizedError(response)) {
                        markFailed(logId, {
                            errorCode: response.code,
                            errorMessage: response?.data?.message,
                            retryCount: response?._retryCount ?? 0
                        })
                    } else {
                        removeLog(logId)
                    }
                })
                return response
            } catch (error: any) {
                logIdPromise.then((logId) => {
                    markFailed(logId, {
                        errorCode: error?.code,
                        errorMessage: error?.message,
                        retryCount: error?.config?._retryCount ?? 0
                    })
                })
                throw error
            }
        }) as T
    }

    /**
     * 返回 Axios 请求器
     */
    return {
        _instance: axiosInstance,
        name: 'AxiosRequester',
        baseURL,
        get: withLog('get', axiosInstance.get, false),
        post: withLog('post', axiosInstance.post, true),
        put: withLog('put', axiosInstance.put, true),
        delete: withLog('delete', axiosInstance.delete, false)
    }
}
