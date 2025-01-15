import type { Requester } from '@nao-todo/types'

export default (baseURL: string): Requester => {
    const _uniRequest = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, data?: any) => {
        const userToken = uni.getStorageSync('USER_JWT')
        const fullURL = `${baseURL}${url}`
        console.log(fullURL)
        return uni.request({
            header: { Authorization: `Bearer ${userToken}` },
            method,
            url: fullURL,
            data
        })
    }

    return {
        name: 'UniRequester',
        baseURL,
        get: (url: string) => _uniRequest('GET', url),
        post: (url: string, data: any) => _uniRequest('POST', url, data),
        put: (url: string, data: any) => _uniRequest('PUT', url, data),
        delete: (url: string) => _uniRequest('DELETE', url)
    }
}
