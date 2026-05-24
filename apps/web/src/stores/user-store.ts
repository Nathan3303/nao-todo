import type {
    UserViewObject,
    UpdateUserViewObject,
    UserConfigViewObject,
    UpdateUserConfigViewObject
} from '@nao-todo/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { env } from '@/infrastructure/constants/env'

const useUserStore = defineStore('UserStore', () => {
    // @state 用户是否登录
    const isAuthenticated = ref(false)

    // @action 设置用户登录状态
    const setIsAuthenticated = (value: boolean) => {
        isAuthenticated.value = value
    }

    // @state 用户凭证（令牌）
    const userToken = ref('')

    // @action 设置用户凭证
    const setUserToken = (token: string) => {
        userToken.value = token
    }

    // @state 用户配置文件
    const userProfile = ref<UserViewObject>()

    // @action 设置用户配置文件
    const setUserProfile = (profile: UserViewObject) => {
        // 处理 avatar 字段
        if (profile.avatar) {
            profile.avatar = `${env.baseURL}${profile.avatar}?timestamp=${Date.now()}`
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

    // @returns
    return {
        isAuthenticated: computed(() => isAuthenticated.value),
        setIsAuthenticated,
        token: computed(() => userToken.value),
        setUserToken,
        profile: computed(() => userProfile.value),
        setUserProfile,
        updateUserProfile,
        config: computed(() => userConfig.value),
        setUserConfig,
        updateUserConfig
    }
})

export default useUserStore

