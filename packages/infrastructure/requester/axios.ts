import Axios from 'axios' // type InternalAxiosRequestConfig // AxiosError
import type { Requester } from '@nao-todo/types'

/**
 * 创建 Axios 请求器
 * @param baseURL 基础 URL
 * @returns Axios 请求器
 */
export default (baseURL: string): Requester => {
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
     * @description 处理网络错误，返回统一的错误响应格式
     */
    axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
            switch (error.code) {
                // 处理请求过于频繁的错误
                case 'TOO_MANY_REQUESTS':
                    return Promise.resolve({
                        code: error.code,
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
     * 返回 Axios 请求器
     */
    return {
        _instance: axiosInstance,
        name: 'AxiosRequester',
        baseURL,
        get: axiosInstance.get,
        post: axiosInstance.post,
        put: axiosInstance.put,
        delete: axiosInstance.delete
    }
}

