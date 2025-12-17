import { useAxios } from '@nao-todo/hooks'
import useUserStore from './use-user-store-v2'
import type { ResponseData } from '@nao-todo/types'
import { NueMessage } from 'nue-ui'

export const requester = useAxios('http://localhost:3302/api/')

// 注册验证响应拦截器 - 当用户验证未通过时，自动登出并跳转登录页
requester._instance.interceptors.response.use((response) => {
    // 判断是否是用户凭证无效错误
    if (!response.config.url?.startsWith('/user') && response.status === 200) {
        const responseData = response.data as ResponseData
        if (responseData.code > 10040 && responseData.code < 10050) {
            NueMessage.error('用户凭证失效，请重新登录')
            useUserStore().signoutAndRedirect()
        }
    }
    // 返回原始响应
    return response
})

export const pingServerByXHR = async (): Promise<number> => {
    let abortController: AbortController | null = null

    const ping = async () => {
        if (abortController) abortController.abort()
        abortController = new AbortController()
        try {
            const response = await requester.get('/user/validate', {
                signal: abortController.signal
            })
            return (response.data as ResponseData).code
        } catch (error) {
            console.error('[@nao-todo/apis/ping-server-by-xhr] Error:', error)
            return 500
        } finally {
            if (abortController && abortController.signal.aborted) {
                abortController = null
            }
        }
    }

    return await ping()
}
