import useAxios from './use-axios'
import useUniRequest from './use-uni-request'
import { baseURL } from '@nao-todo/utils/axios'

const ApiBaseURL = baseURL

const shadowRequester = (() => {
    try {
        return uni ? useUniRequest(ApiBaseURL) : useAxios(ApiBaseURL)
    } catch (e) {
        console.log('[useRequester] UniInstance is not defined.', e)
        return useAxios(ApiBaseURL)
    }
})()

export const useRequester = () => shadowRequester
