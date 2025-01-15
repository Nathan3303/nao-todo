import Axios from 'axios'
import type { Requester } from '@nao-todo/types'

export default (baseURL: string): Requester => {
    const axiosInstance = Axios.create({
        baseURL,
        timeout: 10000
    })

    // Add token to request header
    axiosInstance.interceptors.request.use((config) => {
        const userToken = localStorage.getItem('USER_JWT')
        config.headers.Authorization = `Bearer ${userToken || ''}`
        return config
    })

    return {
        name: 'AxiosRequester',
        baseURL,
        get: axiosInstance.get,
        post: axiosInstance.post,
        put: axiosInstance.put,
        delete: axiosInstance.delete
    }
}
