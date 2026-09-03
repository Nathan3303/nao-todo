import { reactive } from 'vue'
import type { AuthStore, UserDeletion } from '@nao-todo/domain-identity'

type AuthStoreStates = {
    isAuthenticated: boolean
    userToken: string
} & UserDeletion

/**
 * 认证存储基础
 * @returns 认证存储接口
 */
export const useAuthStoreBase = (): AuthStore => {
    // @state states 认证存储状态
    const states = reactive<AuthStoreStates>({
        isAuthenticated: false,
        userToken: '',
        isPending: false,
        deadline: void 0
    })

    /**
     * 设置用户删除信息
     * @param userDeletion 新删除信息
     */
    const setUserDeletion = (userDeletion: UserDeletion) => {
        states.isPending = userDeletion.isPending
        states.deadline = userDeletion.deadline
    }

    /**
     * 清除用户数据
     */
    const clearAuthData = () => {
        states.isAuthenticated = false
        states.userToken = ''
    }

    // @returns 认证存储接口
    return {
        getIsAuthenticated: () => states.isAuthenticated,
        setIsAuthenticated: (isAuthenticated: boolean) =>
            (states.isAuthenticated = isAuthenticated),
        setUserToken: (token: string) => (states.userToken = token),
        setUserDeletion,
        clearAuthData
    }
}