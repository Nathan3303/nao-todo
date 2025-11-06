import { defineStore, storeToRefs } from 'pinia'
import { useViewStore } from '@/stores/global'

const useViewSetterStore = defineStore('ViewSetterStore', () => {
    // @stores 全局 stores
    const viewStore = useViewStore()

    // @states 前置状态
    const {
        isUseFloatSettingsAsideDefaultly,
        isUseFloatTasksAsideDefaultly,
        isUseFloatTasksOutlineDefaultly,
        landingPage
    } = storeToRefs(viewStore)

    // @methods 更新 Tasks 界面是否默认使用浮动侧边栏
    const updateIsUseFloatSettingsAsideDefaultly = (newValue: boolean) => {
        isUseFloatSettingsAsideDefaultly.value = newValue
    }

    // @methods 更新 Tasks 界面是否默认使用浮动详情栏
    const updateIsUseFloatTasksOutlineDefaultly = (newValue: boolean) => {
        isUseFloatTasksOutlineDefaultly.value = newValue
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

