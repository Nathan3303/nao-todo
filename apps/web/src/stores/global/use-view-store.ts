import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { useWindowResizeListener } from '@nao-todo/hooks'

const useViewStore = defineStore('viewStore', () => {
    // @states 响应式标记 -  0: 移动端 | 1-2: 移动端 (平板) | 3-4: 桌面端 | 5: 桌面端 (大屏) | 6: 电视
    const responsiveFlag = ref<number>(2)
    const responsiveWidths = [445, 800, 1200, 1600, 1920, 2560, 3840]
    const { addCallback: addWindowResizeCb } = useWindowResizeListener()

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
    addWindowResizeCb(responsiveFlagUpdater, true)

    // @state 任务界面默认值
    const tasksDefaults = ref({
        isUseFloatAside: false,
        isUseFloatOutline: false
    })

    // @state 是否显示应用级的侧边栏
    const appAsideStates = reactive({
        floating: false,
        visible: false
    })

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

    return {
        responsiveFlag,
        tasksDefaults,
        appAsideStates,
        hideFirstLoadingScreen
    }
})

export default useViewStore
