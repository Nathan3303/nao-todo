import { reactive } from 'vue'
import type { AuthStore, AuthStoreStates } from '../types'

/**
 * 认证存储基础
 * @returns 认证存储接口
 */
export const useAuthStoreBase = (): AuthStore => {
    // @state states 认证存储状态
    const states = reactive<AuthStoreStates>({
        isAuthenticated: false
        // userToken: ''
    })

    /**
     * 是否认证
     */
    const getIsAuthenticated = () => states.isAuthenticated

    /**
     * 设置是否认证
     * @param isAuthenticated 是否认证
     */
    const setIsAuthenticated = (isAuthenticated: boolean) => {
        states.isAuthenticated = isAuthenticated
    }

    /**
     * 设置用户令牌
     * @param userToken 用户令牌
     */
    // const setUserToken = (userToken: string) => {
    //     states.userToken = userToken
    // }

    /**
     * 清除用户数据
     */
    const clearAuthData = () => {
        states.isAuthenticated = false
        // states.userToken = ''
    }

    // @returns 认证存储接口
    return {
        // isAuthenticated: computed(() => states.isAuthenticated),
        // userToken: computed(() => states.userToken),
        getIsAuthenticated,
        setIsAuthenticated,
        // setUserToken,
        clearAuthData
    }
}

