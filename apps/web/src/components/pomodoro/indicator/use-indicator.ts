import { usePomodoroStore, usePomodoroTimerStore } from '@/stores'
// import usePomodoroFocusStore from '@/stores/pomodoro-focus-store'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

export const useIndicator = () => {
    /**
     * 前置状态
     * @use router 路由实例
     * @use pomodoroStore Pomodoro 状态管理实例
     * @use pomodoroTimerStore Pomodoro 定时器状态管理实例
     * @use pomodoroFocusStore Pomodoro 专注状态状态管理实例
     */
    const router = useRouter()
    const pomodoroStore = usePomodoroStore()
    const pomodoroTimerStore = usePomodoroTimerStore()
    // const pomodoroFocusStore = usePomodoroFocusStore()

    /**
     * @computed 进度百分比（已完成的比例，从 total → 0）
     */
    const progress = computed(() => {
        if (pomodoroTimerStore.totalSeconds === 0) return 0
        return Math.round(
            ((pomodoroTimerStore.totalSeconds - pomodoroTimerStore.remainingSeconds) /
                pomodoroTimerStore.totalSeconds) *
                100
        )
    })

    /**
     * @computed 进度条颜色：专注用主色，休息用成功色
     */
    const indicatorColor = computed(() => {
        if (pomodoroTimerStore.phase === 'focus') {
            return 'var(--nue-primary-color-900)'
        }
        return 'var(--nue-primary-color-600)'
    })

    /**
     * @computed 阶段中文标签
     */
    const phaseLabel = computed(() => {
        switch (pomodoroTimerStore.phase) {
            case 'focus':
                return '专注中'
            case 'break':
                return '休息中'
            case 'longBreak':
                return '长休息中'
            default:
                return ''
        }
    })

    /**
     * @computed 剩余时间 MM:SS
     */
    const timeDisplay = computed(() => {
        const mins = Math.floor(pomodoroTimerStore.remainingSeconds / 60)
        const secs = pomodoroTimerStore.remainingSeconds % 60
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    })

    /**
     * @computed 当前专注任务名称（仅专注阶段显示）
     */
    const taskName = computed(() => {
        if (pomodoroTimerStore.phase !== 'focus') return ''
        return pomodoroStore.currentTaskName || ''
    })

    /**
     * @computed 是否显示（非空闲态）
     */
    const isActive = computed(() => pomodoroTimerStore.phase !== 'idle')

    /**
     * @handler 点击跳转到计时器页面
     */
    const goToTimer = () => {
        router.push('/pomodoro/timer')
    }

    // @returns
    return {
        progress,
        indicatorColor,
        phaseLabel,
        timeDisplay,
        taskName,
        isActive,
        goToTimer
    }
}

