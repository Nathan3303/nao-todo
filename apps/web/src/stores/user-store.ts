import type { UserViewObject, UpdateUserViewObject } from '@nao-todo/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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
        userProfile.value = profile
    }

    // @action 更新用户配置文件
    const updateUserProfile = (updateProfile: UpdateUserViewObject) => {
        userProfile.value = { ...userProfile.value, ...updateProfile } as UserViewObject
    }

    // @returns
    return {
        isAuthenticated: computed(() => isAuthenticated.value),
        setIsAuthenticated,
        token: computed(() => userToken.value),
        setUserToken,
        profile: computed(() => userProfile.value),
        setUserProfile,
        updateUserProfile
    }
})

export default useUserStore
