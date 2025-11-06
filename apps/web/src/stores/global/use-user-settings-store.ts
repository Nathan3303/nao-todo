import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { UserPreference } from '@nao-todo/types'

const defaultUserPreference: UserPreference = {
    // 是否默认使用应用级浮动侧边栏
    isUseFloatAsideDefaultly: { tasks: false, calendar: false, settings: false },
    // 是否默认使用应用级浮动任务详情侧边栏
    isUseFloatOutlineDefaultly: { tasks: false, calendar: false, settings: false },
    // 落地页
    landingPage: 'tasks',
    // 任务界面菜单项的显示与隐藏
    tasksAsideNavLinkVisible: {
        all: true,
        today: true,
        tomorrow: true,
        week: true,
        inbox: true,
        favorite: true,
        deleted: true,
        overdue: true,
        filter: true
    }
}

const USER_PREFERENCE_LSKEY = 'USER_PREFERENCE'

const useUserSettingsStore = defineStore('UserSettingsStore', () => {
    // @state 用户 ID - 由 userStore 修改
    const userId = ref<string>('')

    // @state 用户偏好
    const userPreference = ref<UserPreference>({ ...defaultUserPreference })

    // @computed 存储 KEY 名
    const userPreferenceStorageKey = computed(() => USER_PREFERENCE_LSKEY + `/${userId.value}`)

    // @method 从本地存储获取用户偏好
    const getUserPreferenceFromLocalStorage = () => {
        try {
            const localPreference = localStorage.getItem(userPreferenceStorageKey.value)
            if (localPreference) {
                userPreference.value = JSON.parse(localPreference)
            }
        } catch (e) {
            console.error('获取本地用户偏好失败', e)
            userPreference.value = { ...defaultUserPreference }
        }
        // console.log('获取本地用户偏好成功', userPreference.value)
    }

    // @method 保存用户偏好到本地存储
    const saveUserPreferenceToLocalStorage = (newPreference: UserPreference) => {
        try {
            localStorage.setItem(userPreferenceStorageKey.value, JSON.stringify(newPreference))
        } catch (e) {
            console.error('保存本地用户偏好失败', e)
        }
    }

    // @watch 监听用户偏好变化, 保存用户偏好到本地存储
    watch(
        () => userPreference.value,
        (newPreference) => saveUserPreferenceToLocalStorage(newPreference),
        { deep: true }
    )

    // @returns
    return {
        userId,
        userPreference,
        getUserPreferenceFromLocalStorage,
        saveUserPreferenceToLocalStorage
    }
})
export default useUserSettingsStore
