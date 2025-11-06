import { ref, computed } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useViewStore } from '@/stores/global'

const useSettingsViewStore = defineStore('SettingsViewStore', () => {
    // @states 全局 Store
    const viewStore = useViewStore()

    // @states 前置状态
    const {
        responsiveFlag,
        appAsideStates,
        globalAsideWidth,
        isUseFloatSettingsAsideDefaultly,
        tasksAsideNavLinkVisible
    } = storeToRefs(viewStore)

    // @states 是否显示侧边栏
    const isDisplayAside = ref<boolean>(true)

    // @computed 是否使用浮动侧边栏
    const isUseFloatAside = computed(() => {
        const flag = responsiveFlag.value < 2 || isUseFloatSettingsAsideDefaultly.value
        appAsideStates.value.floating = flag
        return flag
    })

    // @methods 切换侧边栏显示状态
    const switchIsDisplayAside = () => {
        // 当使用浮动侧边栏时，不切换侧边栏显示状态
        if (isUseFloatAside.value) {
            appAsideStates.value.visible = !appAsideStates.value.visible
            return
        }
        isDisplayAside.value = !isDisplayAside.value
    }

    // @returns
    return {
        asideWidth: globalAsideWidth,
        handleAsideResize: viewStore.handleAsideResize,
        isDisplayAside,
        isUseFloatAside,
        switchIsDisplayAside,
        tasksAsideNavLinkVisible
    }
})

export default useSettingsViewStore


