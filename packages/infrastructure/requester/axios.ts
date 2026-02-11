import Axios from // AxiosError
// type InternalAxiosRequestConfig
'axios'
import type { Requester } from '@nao-todo/types'
// import type { RequesterOpRtn } from './types'

export default (baseURL: string): Requester => {
    const axiosInstance = Axios.create({
        baseURL,
        timeout: 5000,
        withCredentials: true,
        headers: {
            'Content-Type': 'application/json; charset=UTF-8'
        }
    })

    // Add token to request header
    // axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig<any>) => {
    //     const userToken = localStorage.getItem('USER_JWT')
    //     config.headers.Authorization = `Bearer ${userToken || ''}`
    //     return config
    // })

    // Add error handler
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

    // GET Request with error handling
    // const get: Requester['get'] = async (url: string, config?: any) => {
    //     try {
    //         return await axiosInstance.get(url, config)
    //     } catch (err) {
    //         if (err instanceof AxiosError) {
    //             return {
    //                 data: null,
    //                 message: err.message,
    //                 code: err.response?.status || 500
    //             }
    //         }
    //         return { data: null, message: '未知错误', code: 500 }
    //     }
    // }

    // // POST Request with error handling
    // const post: Requester['post'] = async (url: string, data?: any, config?: any) => {
    //     try {
    //         const r = await axiosInstance.post(url, data, config)
    //         console.log(r)
    //         return r
    //     } catch (e) {
    //         console.log(e)
    //     }
    // }

    // // PUT Request with error handling
    // const put: Requester['put'] = async (url: string, data?: any, config?: any) => {
    //     try {
    //         return await axiosInstance.put(url, data, config)
    //     } catch (err) {
    //         if (err instanceof AxiosError) {
    //             return {
    //                 data: null,
    //                 message: err.message,
    //                 code: err.response?.status || 500
    //             }
    //         }
    //         return { data: null, message: '未知错误', code: 500 }
    //     }
    // }

    // // DELETE Request with error handling
    // const deleteReq: Requester['delete'] = async (url: string, config?: any) => {
    //     try {
    //         return await axiosInstance.delete(url, config)
    //     } catch (err) {
    //         if (err instanceof AxiosError) {
    //             return {
    //                 data: null,
    //                 message: err.message,
    //                 code: err.response?.status || 500
    //             }
    //         }
    //         return { data: null, message: '未知错误', code: 500 }
    //     }
    // }

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
