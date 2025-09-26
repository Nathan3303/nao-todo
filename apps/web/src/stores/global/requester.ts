import { useAxios } from '@nao-todo/hooks'
import type { ResponseData } from '@nao-todo/types'

export const requester = useAxios('http://localhost:3303/api/')

export const pingServerByXHR = async (): Promise<boolean> => {
    try {
        const response = await requester.get('/user/validate')
        const responseData = response.data as ResponseData
        return response.status === 200 && responseData.code === 200
    } catch (error) {
        console.error('[PingServerByXHR] Error: ', error)
        return false
    }
}
