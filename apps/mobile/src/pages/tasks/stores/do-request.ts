import type { ResponseData } from '@nao-todo/types'

export const doRequest = async (options: UniNamespace.RequestOptions) => {
    const token = uni.getStorageSync('USER_JWT')
    const response = await uni.request({
        header: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
        },
        ...options
    })
    return response.data as ResponseData
}
