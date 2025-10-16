import { ref, computed } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useViewStore } from '@/stores/global'

const useSettingsViewStore = defineStore('SettingsViewStore', () => {
    // @states 读取侧边栏宽度记录
    const asideWidth = ref(localStorage.getItem('TASKS_ASIDE_WIDTH') || '256px')

    // @methods 写入侧边栏宽度记录 - 当侧边栏宽度手动修改时调用
    const handleAsideResize = (newWidth: number) => {
        localStorage.setItem('TASKS_ASIDE_WIDTH', newWidth + 'px')
    }

    // @states 全局 Store
    const viewStore = useViewStore()

    // @states 前置状态
    const { responsiveFlag, tasksDefaults, appAsideStates } = storeToRefs(viewStore)

    // @states 是否显示侧边栏
    const isDisplayAside = ref<boolean>(true)

    // @computed 是否使用浮动侧边栏
    const isUseFloatAside = computed(() => {
        const flag = responsiveFlag.value < 2 || tasksDefaults.value.isUseFloatAside
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
        asideWidth,
        handleAsideResize,
        isDisplayAside,
        isUseFloatAside,
        switchIsDisplayAside
    }
})

export default useSettingsViewStore
