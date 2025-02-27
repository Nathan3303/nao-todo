import useAxios from './use-axios'
import useUniRequest from './use-uni-request'

const developmentBaseURL = 'http://localhost:3002/api'
// const productionBaseURL = 'https://nathan33.xyz:3002/api'

const ApiBaseURL = developmentBaseURL

const shadowRequester = (() => {
    try {
        return uni ? useUniRequest(ApiBaseURL) : useAxios(ApiBaseURL)
    } catch (e) {
        console.log('[useRequester] UniInstance is not defined.', e)
        return useAxios(ApiBaseURL)
    }
})()

export const useRequester = () => shadowRequester
