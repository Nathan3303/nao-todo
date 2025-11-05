import { defineStore, storeToRefs } from 'pinia'
import { useViewStore, useUserStoreV2 } from '@/stores/global'

const useViewSetterStore = defineStore('ViewSetterStore', () => {
    // @stores 全局 stores
    const viewStore = useViewStore()
    const userStore = useUserStoreV2()

    // @states 前置状态
    const {
        isUseFloatSettingsAsideDefaultly,
        isUseFloatTasksAsideDefaultly,
        isUseFloatTasksOutlineDefaultly,
        landingPage
    } = storeToRefs(viewStore)
    const { user } = storeToRefs(userStore)

    // @methods 更新 Tasks 界面是否默认使用浮动侧边栏
    const updateIsUseFloatSettingsAsideDefaultly = (newValue: boolean) => {
        if (!user.value?.preference?.isUseFloatAsideDefaultly?.tasks) return
        user.value.preference.isUseFloatAsideDefaultly.tasks = newValue
    }

    // @methods 更新 Tasks 界面是否默认使用浮动详情栏
    const updateIsUseFloatTasksOutlineDefaultly = (newValue: boolean) => {
        if (!user.value?.preference?.isUseFloatOutlineDefaultly?.tasks) return
        user.value.preference.isUseFloatOutlineDefaultly.tasks = newValue
    }

    // @returns
    return {
        isUseFloatTasksAsideDefaultly,
        isUseFloatTasksOutlineDefaultly,
        isUseFloatSettingsAsideDefaultly,
        updateIsUseFloatSettingsAsideDefaultly,
        updateIsUseFloatTasksOutlineDefaultly,
        landingPage
    }
})

export default useViewSetterStore


