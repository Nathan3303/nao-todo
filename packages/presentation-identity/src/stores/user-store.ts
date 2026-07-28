import type { UserConfigViewObject, UserDeletion, UserViewObject } from '@nao-todo/domain-identity'
import { useStoreBase } from '@nao-todo/shared'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useAuthStoreBase } from '../hooks'

export const useUserStore = defineStore('UserStore', () => {
    // @state 认证状态
    const { getIsAuthenticated, setIsAuthenticated, clearAuthData } = useAuthStoreBase()

    // @storebase 用户信息
    const {
        state: userProfile,
        setState: setUserProfileBase,
        updateState: updateUserProfile
    } = useStoreBase<UserViewObject>()

    // @storebase 用户配置
    const {
        state: userConfig,
        setState: setUserConfig,
        updateState: updateUserConfig
    } = useStoreBase<UserConfigViewObject>()

    // @storebase 用户注销相关
    const {
        state: userDeletion,
        setState: setUserDeletion,
        updateState: updateUserDeletion
    } = useStoreBase<UserDeletion>()

    // @action 设置用户信息
    const setUserProfile = (profile: UserViewObject) => {
        // 处理 avatar 字段
        if (profile.avatar) {
            profile.avatar = `${profile.avatar}?t=${Date.now()}`
        }
        // 设置存储
        setUserProfileBase(profile)
    }

    // @action 清除用户数据
    const clearUserData = () => {
        setUserProfile({} as UserViewObject)
        setUserConfig({} as UserConfigViewObject)
        setUserDeletion({} as UserDeletion)
        localStorage.clear()
    }

    // @returns
    return {
        // auth
        getIsAuthenticated,
        setIsAuthenticated,
        clearAuthData,
        // user
        profile: computed(() => userProfile.value),
        setUserProfile,
        updateUserProfile,
        config: computed(() => userConfig.value),
        setUserConfig,
        updateUserConfig,
        userDeletion,
        setUserDeletion,
        updateUserDeletion,
        // ---
        clearUserData
    }
})

export default useUserStore