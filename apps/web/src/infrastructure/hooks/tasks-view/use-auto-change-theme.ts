import { useMinuteTask } from '@nao-todo/hooks'
import { ref, watch } from 'vue'

const useAutoChangeTheme = (defaultIsAutoChange: boolean) => {
    // @state 当前主题标记 - 0: 日间 | 1: 夜间
    const themeFlag = ref<number>(0)

    // @state 自动切换标记
    const isAutoChange = ref<boolean>(defaultIsAutoChange)

    // @method 时间检测
    const checkTime = () => {
        const hour = new Date().getHours()
        const isInRange = hour >= 6 && hour < 18
        themeFlag.value = isInRange ? 0 : 1
    }

    // @hook 分钟任务
    const authChangeMinuteTask = useMinuteTask(checkTime)

    // @watch 自动切换标记
    watch(
        isAutoChange,
        (newValue) => {
            if (newValue) {
                authChangeMinuteTask.run()
            } else {
                authChangeMinuteTask.stop()
            }
        },
        { immediate: true }
    )

    // @watch 当前主题标记
    watch(
        themeFlag,
        (newValue) => {
            document.documentElement.style.setProperty('--nue-dark-switch', newValue.toString())
        },
        { immediate: true }
    )

    // @action 初始化时检测一次
    checkTime()

    // @returns
    return {
        themeFlag,
        isAutoChange
    }
}

export default useAutoChangeTheme
