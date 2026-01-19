import Axios, { type InternalAxiosRequestConfig } from 'axios'
import type { Requester } from '@nao-todo/types'

export default (baseURL: string): Requester => {
    const axiosInstance = Axios.create({
        baseURL,
        timeout: 5000,
        withCredentials: true,
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
        }
    })

    // Add token to request header
    axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig<any>) => {
        const userToken = localStorage.getItem('USER_JWT')
        config.headers.Authorization = `Bearer ${userToken || ''}`
        return config
    })

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
