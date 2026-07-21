// import { env } from '@/infrastructure/constants/env'
import { useAuthStoreBase } from '@nao-todo/presentation/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
    UpdateUserConfigViewObject,
    UpdateUserViewObject,
    UserConfigViewObject,
    UserViewObject
} from '@nao-todo/application/user/viewobjects'

export const useUserStore = defineStore('UserStore', () => {
    // @state 认证状态
    const { getIsAuthenticated, setIsAuthenticated, clearAuthData } = useAuthStoreBase()

    // @state 用户配置文件
    const userProfile = ref<UserViewObject>()

    // @action 设置用户配置文件
    const setUserProfile = (profile: UserViewObject) => {
        // 处理 avatar 字段
        if (profile.avatar) {
            profile.avatar = `${profile.avatar}?t=${Date.now()}`
        }
        // 设置存储
        userProfile.value = profile
    }

    // @action 更新用户配置文件
    const updateUserProfile = (updateProfile: UpdateUserViewObject) => {
        setUserProfile({ ...userProfile.value, ...updateProfile } as UserViewObject)
    }

    // @state 用户注销截止时间
    const deletionDeadline = ref<string | null>(null)

    // @action 获取用户注销截止时间
    const getDeletionDeadline = () => {
        return deletionDeadline.value
    }

    // @action 设置用户注销截止时间
    const setDeletionDeadline = (deadline: string | null) => {
        deletionDeadline.value = deadline
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
        deletionDeadline,
        getDeletionDeadline,
        setDeletionDeadline,
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
