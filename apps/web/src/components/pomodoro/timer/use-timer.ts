import { ref, computed, onBeforeUnmount } from 'vue'
import type { TimerPhase, TimerStatus, TimerConfig } from './types'

/**
 * useTimer 配置选项
 */
export interface UseTimerOptions {
    /** 初始专注时长（秒） */
    focusDuration: number
    /** 初始休息时长（秒） */
    breakDuration: number
    /** 阶段完成回调 */
    onPhaseComplete?: (phase: TimerPhase, elapsedSeconds: number, totalSeconds: number) => void
    /** 跳过回调 */
    onSkip?: (phase: TimerPhase, elapsedSeconds: number, totalSeconds: number) => void
    /** 休息阶段剩余时间提醒回调（参数为触发时的剩余秒数） */
    onBreakWarning?: (remainingSeconds: number) => void
    /** 长休息时长（秒） */
    longBreakDuration: number
    /** 触发长休息所需的专注次数 */
    sessionsUntilLongBreak: number
}

/**
 * 纯倒计时 composable
 * @description 基于绝对时间（Date.now()）的倒计时逻辑，不受浏览器标签页后台节流影响。
 *              setInterval 仅用于 UI 刷新 tick，实际剩余时间通过目标结束时间与当前时间的差值反算。
 */
export const useTimer = (options: UseTimerOptions) => {
    // @state 当前阶段
    const phase = ref<TimerPhase>('idle')

    // @state 运行状态
    const status = ref<TimerStatus>('paused')

    // @state 剩余秒数（用于 UI 绑定）
    const remainingSeconds = ref(options.focusDuration)

    // @state 当前阶段总秒数
    const totalSeconds = ref(options.focusDuration)

    // 内部配置（可被 updateConfig 更新）
    const config = {
        focusDuration: options.focusDuration,
        breakDuration: options.breakDuration,
        longBreakDuration: options.longBreakDuration,
        sessionsUntilLongBreak: options.sessionsUntilLongBreak
    }

    // 定时器间隔 ID
    let intervalId: ReturnType<typeof setInterval> | null = null

    // 当前阶段的绝对结束时间（Date.now() 时间戳，毫秒）
    let targetEndTime = 0

    // 暂停时捕获的剩余毫秒数
    let pausedRemainingMs = 0

    // 最后一次 tick 时的 Date.now()，用于兼容系统时间回拨
    let lastTickNow = 0

    // 当前休息阶段是否已发送 20% 剩余提醒
    let breakWarningSent = false

    // 当前周期内已完成的轮数（一轮 = 一次专注 + 一次短休息）
    // 达到 sessionsUntilLongBreak 后，下一次专注完成时触发长休息
    let completedRoundCount = 0

    // @computed 是否空闲
    const isIdle = computed(() => phase.value === 'idle')

    // @computed 是否正在运行
    const isRunning = computed(() => status.value === 'running')

    /**
     * 基于绝对时间计算当前剩余秒数
     */
    const calcRemaining = (): number => {
        if (phase.value === 'idle') return remainingSeconds.value
        if (status.value === 'paused') return Math.max(0, Math.ceil(pausedRemainingMs / 1000))
        return Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000))
    }

    /**
     * 单次 tick：刷新显示并检查阶段是否结束
     */
    const tick = () => {
        if (status.value !== 'running') return

        const now = Date.now()
        // 防御系统时间回拨（将 lastTickNow 重置为更早的时间）
        if (now < lastTickNow) {
            lastTickNow = now
        }
        lastTickNow = now

        remainingSeconds.value = Math.max(0, Math.ceil((targetEndTime - now) / 1000))

        // 休息阶段剩余时间提醒：取 20% 和 3 分钟的较小值作为触发阈值
        if (
            !breakWarningSent &&
            (phase.value === 'break' || phase.value === 'longBreak') &&
            totalSeconds.value > 0
        ) {
            const threshold = Math.min(Math.ceil(totalSeconds.value * 0.2), 180) // 3 分钟 = 180 秒
            if (remainingSeconds.value <= threshold) {
                breakWarningSent = true
                options.onBreakWarning?.(remainingSeconds.value)
            }
        }

        if (remainingSeconds.value <= 0) {
            handlePhaseComplete()
        }
    }

    /**
     * 启动 UI 刷新定时器
     */
    const startInterval = () => {
        stopInterval()
        lastTickNow = Date.now()
        intervalId = setInterval(tick, 250)
    }

    /**
     * 停止 UI 刷新定时器
     */
    const stopInterval = () => {
        if (intervalId !== null) {
            clearInterval(intervalId)
            intervalId = null
        }
    }

    /**
     * 标签页可见性变化处理：恢复可见时立即重算并重绘
     */
    const handleVisibilityChange = () => {
        if (document.hidden) return
        if (status.value !== 'running') return
        tick()
    }

    // 注册 visibilitychange 监听
    document.addEventListener('visibilitychange', handleVisibilityChange)

    /**
     * 处理阶段完成
     */
    const handlePhaseComplete = () => {
        stopInterval()
        const completedPhase = phase.value
        const elapsed = totalSeconds.value

        if (completedPhase === 'focus') {
            const isLongBreak = completedRoundCount >= config.sessionsUntilLongBreak
            const nextPhase: TimerPhase = isLongBreak ? 'longBreak' : 'break'
            const nextDuration = isLongBreak ? config.longBreakDuration : config.breakDuration

            options.onPhaseComplete?.('focus', elapsed, totalSeconds.value)
            phase.value = nextPhase
            breakWarningSent = false
            if (isLongBreak) {
                completedRoundCount = 0
            }
            totalSeconds.value = nextDuration
            remainingSeconds.value = nextDuration
            targetEndTime = Date.now() + nextDuration * 1000
            status.value = 'running'
            startInterval()
        } else if (completedPhase === 'break' || completedPhase === 'longBreak') {
            // 短休息自然完成 → 一轮结束，递增轮数
            if (completedPhase === 'break') {
                completedRoundCount++
            }
            options.onPhaseComplete?.(completedPhase, elapsed, totalSeconds.value)
            phase.value = 'focus'
            totalSeconds.value = config.focusDuration
            remainingSeconds.value = config.focusDuration
            targetEndTime = Date.now() + config.focusDuration * 1000
            status.value = 'running'
            startInterval()
        }
    }

    /**
     * 开始专注
     */
    const start = () => {
        stopInterval()
        phase.value = 'focus'
        status.value = 'running'
        totalSeconds.value = config.focusDuration
        remainingSeconds.value = config.focusDuration
        targetEndTime = Date.now() + config.focusDuration * 1000
        startInterval()
    }

    /**
     * 暂停
     */
    const pause = () => {
        if (status.value !== 'running') return
        status.value = 'paused'
        pausedRemainingMs = targetEndTime - Date.now()
        // 暂停时仍做一次修正显示
        remainingSeconds.value = Math.max(0, Math.ceil(pausedRemainingMs / 1000))
        stopInterval()
    }

    /**
     * 继续
     */
    const resume = () => {
        if (status.value !== 'paused') return
        status.value = 'running'
        targetEndTime = Date.now() + pausedRemainingMs
        tick()
        startInterval()
    }

    /**
     * 重置（回到 idle）
     */
    const reset = () => {
        stopInterval()
        phase.value = 'idle'
        status.value = 'paused'
        completedRoundCount = 0
        totalSeconds.value = config.focusDuration
        remainingSeconds.value = config.focusDuration
        targetEndTime = 0
        pausedRemainingMs = 0
    }

    /**
     * 跳过当前阶段，进入下一阶段
     */
    const skip = () => {
        stopInterval()
        const skippedPhase = phase.value
        const remaining = calcRemaining()
        const elapsed = totalSeconds.value - remaining

        options.onSkip?.(skippedPhase, elapsed, totalSeconds.value)

        if (skippedPhase === 'focus') {
            const isLongBreak = completedRoundCount >= config.sessionsUntilLongBreak
            const nextPhase: TimerPhase = isLongBreak ? 'longBreak' : 'break'
            const nextDuration = isLongBreak ? config.longBreakDuration : config.breakDuration

            phase.value = nextPhase
            breakWarningSent = false
            if (isLongBreak) {
                completedRoundCount = 0
            }
            totalSeconds.value = nextDuration
            remainingSeconds.value = nextDuration
            targetEndTime = Date.now() + nextDuration * 1000
        } else if (skippedPhase === 'break' || skippedPhase === 'longBreak') {
            phase.value = 'focus'
            totalSeconds.value = config.focusDuration
            remainingSeconds.value = config.focusDuration
            targetEndTime = Date.now() + config.focusDuration * 1000
        }
        status.value = 'running'
        startInterval()
    }

    /**
     * 调整当前阶段剩余时间
     * @param delta 调整的秒数（正数延长，负数缩短）
     * @description 空闲态受 5 分钟 ~ 3 小时边界约束；运行/暂停态仅约束不低于 0
     */
    const adjustTime = (delta: number) => {
        const currentRemaining = calcRemaining()
        const newRemaining = currentRemaining + delta
        if (newRemaining <= 0) return

        // 空闲状态下的调整受边界约束
        if (phase.value === 'idle') {
            const MIN = 5 * 60 // 5 分钟
            const MAX = 180 * 60 // 3 小时
            if (newRemaining < MIN || newRemaining > MAX) return
            config.focusDuration = newRemaining
        }

        remainingSeconds.value = newRemaining
        totalSeconds.value += delta

        // 直接基于 newRemaining 重建时间基准，避免 Math.ceil 取整导致的 1 秒抖动
        if (status.value === 'running') {
            targetEndTime = Date.now() + newRemaining * 1000
        } else if (status.value === 'paused') {
            pausedRemainingMs = newRemaining * 1000
        }
    }

    /**
     * 更新配置
     * @param newConfig 新的配置（部分更新）
     */
    const updateConfig = (newConfig: Partial<TimerConfig>) => {
        if (newConfig.focusDuration !== undefined) {
            config.focusDuration = newConfig.focusDuration
            // 空闲态同步更新显示值
            if (phase.value === 'idle') {
                totalSeconds.value = newConfig.focusDuration
                remainingSeconds.value = newConfig.focusDuration
            }
        }
        if (newConfig.breakDuration !== undefined) {
            config.breakDuration = newConfig.breakDuration
        }
        if (newConfig.longBreakDuration !== undefined) {
            config.longBreakDuration = newConfig.longBreakDuration
        }
        if (newConfig.sessionsUntilLongBreak !== undefined) {
            config.sessionsUntilLongBreak = newConfig.sessionsUntilLongBreak
        }
    }

    // 组件卸载时清理
    onBeforeUnmount(() => {
        stopInterval()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
    })

    return {
        phase: computed(() => phase.value),
        isIdle,
        isRunning,
        remainingSeconds,
        totalSeconds,
        start,
        pause,
        resume,
        reset,
        skip,
        adjustTime,
        updateConfig
    }
}
