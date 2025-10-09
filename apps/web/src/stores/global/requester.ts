import { useAxios } from '@nao-todo/hooks'
import type { ResponseData } from '@nao-todo/types'

export const requester = useAxios('http://localhost:3303/api/')

export const pingServerByXHR = async (): Promise<boolean> => {
    let abortController: AbortController | null = null

    const ping = async () => {
        if (abortController) abortController.abort()
        abortController = new AbortController()
        try {
            const response = await requester.get('/user/validate', {
                signal: abortController.signal
            })
            const responseData = response.data as ResponseData
            return response.status === 200 && responseData.code === 200
        } catch (error) {
            console.error('[@nao-todo/apis/ping-server-by-xhr] Error:', error)
            return false
        } finally {
            if (abortController && abortController.signal.aborted) {
                abortController = null
            }
        }
    }

    return await ping()
}
