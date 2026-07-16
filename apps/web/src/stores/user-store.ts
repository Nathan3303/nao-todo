import { env } from '@/infrastructure/constants/env'
import type {
    UpdateUserConfigViewObject,
    UpdateUserViewObject,
    UserConfigViewObject,
    UserViewObject
} from '@nao-todo/usecases/user'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStoreBase } from '@nao-todo/domain/auth'

const useUserStore = defineStore('UserStore', () => {
    // @state 认证状态
    const { getIsAuthenticated, setIsAuthenticated, clearAuthData } = useAuthStoreBase()

    // @state 用户配置文件
    const userProfile = ref<UserViewObject>()

    // @action 设置用户配置文件
    const setUserProfile = (profile: UserViewObject) => {
        // 处理 avatar 字段
        if (profile.avatar) {
            profile.avatar = `${env.baseURL}${profile.avatar}?t=${Date.now()}`
        }
        // 设置存储
        userProfile.value = profile
    }

    // @action 更新用户配置文件
    const updateUserProfile = (updateProfile: UpdateUserViewObject) => {
        setUserProfile({ ...userProfile.value, ...updateProfile } as UserViewObject)
    }

    // @state 用户配置
    const userConfig = ref<UserConfigViewObject>()

    // @action 设置用户配置
    const setUserConfig = (config: UserConfigViewObject) => {
        userConfig.value = config
    }

    // @action 更新用户配置
    const updateUserConfig = (updateConfig: UpdateUserConfigViewObject) => {
        setUserConfig({ ...userConfig.value, ...updateConfig } as UserConfigViewObject)
    }

    // @action 清除用户数据
    const clearUserData = () => {
        setUserProfile({} as UserViewObject)
        setUserConfig({} as UserConfigViewObject)
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
        clearUserData
    }
})

export default useUserStore
