import { computed, reactive, ref } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import useUserStore from './use-user-store-v2'

const ASIDE_WIDTH_LSKEY = 'GLOBAL_ASIDE_WIDTH'
const OUTLINE_WIDTH_LSKEY = 'GLOBAL_OUTLINE_WIDTH'

const useViewStore = defineStore('viewStore', () => {
    // @stores 全局 stores
    const userStore = useUserStore()

    // @states 前置状态
    const { user } = storeToRefs(userStore)

    // @states 响应式标记 -  0: 移动端 | 1-2: 移动端 (平板) | 3-4: 桌面端 | 5: 桌面端 (大屏) | 6: 电视
    const responsiveFlag = ref<number>(2)
    const responsiveWidths = [445, 800, 1200, 1600, 1920, 2560, 3840]

    // @methods 响应式检测 - 通过 window.innerWidth 和 window.resize 检测
    const responsiveFlagUpdater = () => {
        const innerWidth = window.innerWidth
        if (isNaN(innerWidth)) return
        const startAt = Math.min(Math.floor(innerWidth / 445), 5)
        for (let i = startAt; i < responsiveWidths.length; i++) {
            if (innerWidth > responsiveWidths[i]) continue
            responsiveFlag.value = i
            break
        }
    }

    // @method 隐藏应用加载屏
    const hideFirstLoadingScreen = () => {
        const _fn = () => {
            const fls = document.getElementById('firstLoadingScreen')
            if (!fls) return
            fls.style.transition = 'opacity 320ms ease-in-out'
            fls.style.opacity = '0'
            setTimeout(() => (fls.style.display = 'none'), 320)
        }
        if (window.requestIdleCallback) {
            window.requestIdleCallback(_fn)
        } else {
            _fn()
        }
    }

    // @states 读取侧边栏宽度记录
    const globalAsideWidth = ref(localStorage.getItem(ASIDE_WIDTH_LSKEY) || '256px')
    const globalOutlineWidth = ref(localStorage.getItem(OUTLINE_WIDTH_LSKEY) || '420px')

    // @methods 写入侧边栏宽度记录 - 当侧边栏宽度手动修改时调用
    const handleAsideResize = (newWidth: number) => {
        localStorage.setItem(ASIDE_WIDTH_LSKEY, newWidth + 'px')
    }
    const handleOutlineResize = (newWidth: number) => {
        localStorage.setItem(OUTLINE_WIDTH_LSKEY, newWidth + 'px')
    }

    // @state 是否显示应用级的侧边栏
    const appAsideStates = reactive({
        floating: false,
        visible: false
    })

    // @states 任务界面侧边栏默认值
    const isUseFloatTasksAsideDefaultly = computed({
        get: () => user.value?.preference?.isUseFloatAsideDefaultly?.tasks ?? false,
        set: (newValue: boolean) => {
            if (user.value?.preference?.isUseFloatAsideDefaultly) {
                user.value.preference.isUseFloatAsideDefaultly.tasks = newValue
            }
        }
    })

    // @states 任务界面任务详情侧边栏默认值
    const isUseFloatTasksOutlineDefaultly = computed({
        get: () => user.value?.preference?.isUseFloatOutlineDefaultly?.tasks ?? false,
        set: (newValue: boolean) => {
            if (user.value?.preference?.isUseFloatOutlineDefaultly) {
                user.value.preference.isUseFloatOutlineDefaultly.tasks = newValue
            }
        }
    })

    // @states 设置界面侧边栏默认值
    const isUseFloatSettingsAsideDefaultly = computed({
        get: () => user.value?.preference?.isUseFloatAsideDefaultly?.settings ?? false,
        set: (newValue: boolean) => {
            if (user.value?.preference?.isUseFloatAsideDefaultly) {
                user.value.preference.isUseFloatAsideDefaultly.settings = newValue
            }
        }
    })

    return {
        responsiveFlag,
        responsiveFlagUpdater,
        appAsideStates,
        hideFirstLoadingScreen,
        globalAsideWidth,
        globalOutlineWidth,
        handleAsideResize,
        handleOutlineResize,
        isUseFloatTasksAsideDefaultly,
        isUseFloatTasksOutlineDefaultly,
        isUseFloatSettingsAsideDefaultly
    }
})

export default useViewStore
