import {
    USER_JWT_LOCALSTORAGE_KEY,
    type UserConfigViewObject,
    type UserDeletion,
    type UserViewObject
} from '@nao-todo/domain-identity'
import { useStoreBase } from '@nao-todo/shared'
import { defineStore } from 'pinia'
import { computed, watch } from 'vue'

export const useUserStore = defineStore('UserStore', () => {
    // @storebase 认证状态
    const { state, updateState } = useStoreBase<{
        isAuthenticated: boolean
        userToken: string
    }>({ isAuthenticated: false, userToken: '' })

    // @storebase 用户注销相关
    const {
        state: userDeletion,
        setState: setUserDeletion,
        updateState: updateUserDeletion
    } = useStoreBase<UserDeletion>()

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

    /**
     * 设置用户信息
     * @param profile
     */
    const setUserProfile = (profile: UserViewObject) => {
        // 处理 avatar 字段
        if (profile.avatar) {
            profile.avatar = `${profile.avatar}?t=${Date.now()}`
        }
        // 设置存储
        setUserProfileBase(profile)
    }

    /**
     * 清除认证数据
     */
    const clearAuthData = () => {
        updateState({ isAuthenticated: false, userToken: '' })
        clearUserData()
    }

    /**
     * 清除用户数据
     */
    const clearUserData = () => {
        setUserProfile({} as UserViewObject)
        setUserConfig({} as UserConfigViewObject)
        setUserDeletion({} as UserDeletion)
        localStorage.clear()
    }

    /**
     * 侦听 UserToken 变化,并持久化到 LocalStorage
     */
    watch(
        () => state.value.userToken,
        (nv) => localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, nv)
    )

    // @returns
    return {
        // auth
        getIsAuthenticated: () => state.value.isAuthenticated,
        setIsAuthenticated: (isAuthenticated: boolean) => updateState({ isAuthenticated }),
        setUserToken: (token: string) => updateState({ userToken: token }),
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