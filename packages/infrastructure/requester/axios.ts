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
     */
    axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
            console.error(error)
            return Promise.resolve({
                code: error.code,
                data: {
                    data: null,
                    message: '服务器连接失败',
                    code: error.response?.status || 5001
                }
            })
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
