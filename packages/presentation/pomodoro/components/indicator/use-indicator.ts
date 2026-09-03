import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePomodoroFocusStore, usePomodoroSessionStore, usePomodoroTimerStore } from '../../stores'

export const useIndicator = () => {
    const router = useRouter()
    const sessionStore = usePomodoroSessionStore()
    const pomodoroTimerStore = usePomodoroTimerStore()
    const pomodoroFocusStore = usePomodoroFocusStore()

    /**
     * @computed 进度百分比（已完成的比例，从 total → 0）
     * @description 仅在番茄倒计时时有效；正计时模式下为 0
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
     * @computed 进度条颜色：专注用主色，休息/正计时用次级色
     */
    const indicatorColor = computed(() => {
        if (pomodoroTimerStore.phase === 'focus') {
            return 'var(--nue-primary-color-900)'
        }
        return 'var(--nue-primary-color-400)'
    })

    /**
     * @computed 阶段中文标签
     * @description 优先读取正计时状态（非idle时），再读取番茄倒计时状态
     */
    const phaseLabel = computed(() => {
        if (pomodoroFocusStore.status !== 'idle') return '正计时中'
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
     * @computed 剩余时间显示
     * @description 正计时模式显示已走时间（elapsedSeconds），
     *              番茄倒计时显示剩余时间（remainingSeconds）
     */
    const timeDisplay = computed(() => {
        if (pomodoroFocusStore.status !== 'idle') {
            const secs = pomodoroFocusStore.elapsedSeconds
            const h = Math.floor(secs / 3600)
            const m = Math.floor((secs % 3600) / 60)
            const s = secs % 60
            if (h > 0) {
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            }
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        }
        const mins = Math.floor(pomodoroTimerStore.remainingSeconds / 60)
        const secs = pomodoroTimerStore.remainingSeconds % 60
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    })

    /**
     * @computed 当前关联任务名称
     * @description 优先读取正计时关联任务，再读取番茄倒计时关联任务
     */
    const taskName = computed(() => {
        if (pomodoroFocusStore.status !== 'idle') return sessionStore.currentTaskName || ''
        if (pomodoroTimerStore.phase !== 'focus') return ''
        return sessionStore.currentTaskName || ''
    })

    /**
     * @computed 是否显示计时器指示器（非空闲态）
     */
    const isTimerRunning = computed(() => pomodoroTimerStore.phase !== 'idle')
    const isFocusRunning = computed(() => pomodoroFocusStore.status !== 'idle')

    /**
     * @handler 点击跳转到对应计时器页面
     */
    const goToTimer = () => {
        if (pomodoroFocusStore.status !== 'idle') {
            router.push('/pomodoro/focus')
        } else {
            router.push('/pomodoro/timer')
        }
    }

    // @returns
    return {
        progress,
        indicatorColor,
        phaseLabel,
        timeDisplay,
        taskName,
        isTimerRunning,
        isFocusRunning,
        goToTimer
    }
}