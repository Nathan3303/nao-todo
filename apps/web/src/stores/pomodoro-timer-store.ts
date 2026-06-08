import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { TimerPhase, TimerStatus, PomodoroRecordViewObject } from '@/components/pomodoro/timer/types'
import usePomodoroStore from '@/stores/pomodoro-store'

/**
 * 最短专注时间：5 分钟
 */
const MIN_FOCUS_SECONDS = 5 * 60

/**
 * 最长专注时间：3 小时
 */
const MAX_FOCUS_SECONDS = 180 * 60

/**
 * UI 刷新间隔（毫秒）
 */
const TICK_INTERVAL_MS = 250

/**
 * 全局番茄钟计时器 Store
 * @description 将倒计时引擎从组件级 composable 提取为 Pinia store 全局单例，
 *              使得 setInterval 生命周期与 store 绑定，路由切换后计时器持续运行。
 *
 * 职责：
 * - 倒计时引擎（setInterval tick、targetEndTime 反算）
 * - 阶段状态管理（idle / focus / break / longBreak）
 * - 自动流转（autoRest、autoStartNextFocusSession）
 * - 专注记录创建（写入 usePomodoroStore）
 * - 浏览器通知发送
 *
 * 配置来源：运行时直接从 usePomodoroStore 读取，确保修改即时生效。
 */
export const usePomodoroTimerStore = defineStore('PomodoroTimerStore', () => {
    // ========================================================================
    // Dependencies
    // ========================================================================
    const pomodoroStore = usePomodoroStore()

    // ========================================================================
    // Reactive State
    // ========================================================================
    const phase = ref<TimerPhase>('idle')
    const status = ref<TimerStatus>('paused')
    const remainingSeconds = ref(pomodoroStore.focusDuration)
    const totalSeconds = ref(pomodoroStore.focusDuration)

    // ========================================================================
    // Computed
    // ========================================================================
    const isIdle = computed(() => phase.value === 'idle')
    const isRunning = computed(() => status.value === 'running')

    // ========================================================================
    // Internal Engine State（plain variables，非响应式）
    // ========================================================================
    let targetEndTime = 0
    let pausedRemainingMs = 0
    let intervalId: ReturnType<typeof setInterval> | null = null
    let breakWarningSent = false
    let completedRoundCount = 0
    let autoStartCount = 0

    // ========================================================================
    // Helper Functions
    // ========================================================================

    /**
     * 计算当前剩余秒数
     * - idle 态：直接返回 remainingSeconds
     * - paused 态：基于保存的剩余毫秒数
     * - running 态：基于 targetEndTime 与当前时间差值
     */
    const calcRemaining = (): number => {
        if (phase.value === 'idle') return remainingSeconds.value
        if (status.value === 'paused') return Math.max(0, Math.ceil(pausedRemainingMs / 1000))
        return Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000))
    }

    /** 计算当前阶段已用秒数 */
    const calcElapsed = (): number => totalSeconds.value - calcRemaining()

    /** 判断当前是否该进入长休息 */
    const isLongBreakDue = (): boolean =>
        completedRoundCount >= pomodoroStore.sessionsUntilLongBreak

    /** 发送浏览器系统通知 */
    const sendNotification = (title: string, body: string) => {
        if (!('Notification' in window) || Notification.permission !== 'granted') return
        new Notification(title, { body })
    }

    /** 格式化秒数为中文时间描述 */
    const formatMinutes = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        if (mins < 60) return `${mins} 分钟`
        const hours = Math.floor(mins / 60)
        const remain = mins % 60
        return remain > 0 ? `${hours} 小时 ${remain} 分钟` : `${hours} 小时`
    }

    /**
     * 生成新的专注会话 ID
     * @description 仅在没有当前会话时生成新 ID，避免重复创建
     */
    const generateNewSessionId = () => {
        if (!pomodoroStore.currentRecordId) {
            const recordId = nanoid()
            const startAt = new Date().toISOString()
            pomodoroStore.setCurrentSession(
                pomodoroStore.currentTaskId,
                pomodoroStore.currentTaskName,
                recordId,
                startAt
            )
            pomodoroStore.setNoteText('')
        }
    }

    /** 构建一条专注记录 ViewObject */
    const buildRecord = (total: number): PomodoroRecordViewObject => ({
        id: pomodoroStore.currentRecordId!,
        taskId: pomodoroStore.currentTaskId ?? '',
        name: pomodoroStore.currentTaskName || '未关联任务',
        type: 'timer',
        startAt: pomodoroStore.currentRecordStartAt!,
        endAt: new Date().toISOString(),
        duration: total,
        note: pomodoroStore.noteText
    })

    // ========================================================================
    // Interval & Engine
    // ========================================================================

    const startInterval = () => {
        stopInterval()
        intervalId = setInterval(tick, TICK_INTERVAL_MS)
    }

    const stopInterval = () => {
        if (intervalId !== null) {
            clearInterval(intervalId)
            intervalId = null
        }
    }

    /**
     * 每 250ms 执行的 tick
     * - 更新 remainingSeconds（基于 targetEndTime 反算）
     * - 检测 break warning 阈值（20% 或 3 分钟，取较小值）
     * - 检测阶段完成
     */
    const tick = () => {
        if (status.value !== 'running') return

        remainingSeconds.value = Math.max(
            0,
            Math.ceil((targetEndTime - Date.now()) / 1000)
        )

        // Break warning
        if (
            !breakWarningSent &&
            (phase.value === 'break' || phase.value === 'longBreak') &&
            totalSeconds.value > 0
        ) {
            const threshold = Math.min(Math.ceil(totalSeconds.value * 0.2), 180)
            if (remainingSeconds.value <= threshold) {
                breakWarningSent = true
                const mins = Math.floor(remainingSeconds.value / 60)
                const secs = remainingSeconds.value % 60
                const timeStr =
                    mins > 0
                        ? `${mins} 分钟${secs > 0 ? ` ${secs} 秒` : ''}`
                        : `${secs} 秒`
                sendNotification(
                    '休息即将结束',
                    `剩余 ${timeStr} 的休息时间，准备好进行下一轮专注了吗？`
                )
            }
        }

        if (remainingSeconds.value <= 0) {
            handlePhaseComplete()
        }
    }

    // ========================================================================
    // Visibility Change（页面切换回来后修正时间显示）
    // ========================================================================

    let visibilityHandler: (() => void) | null = null

    const setupVisibilityListener = () => {
        if (visibilityHandler) return
        visibilityHandler = () => {
            if (document.hidden) return
            if (status.value !== 'running') return
            requestAnimationFrame(() => {
                if (status.value === 'running') tick()
            })
        }
        document.addEventListener('visibilitychange', visibilityHandler)
    }

    const teardownVisibilityListener = () => {
        if (visibilityHandler) {
            document.removeEventListener('visibilitychange', visibilityHandler)
            visibilityHandler = null
        }
    }

    // ========================================================================
    // Phase Transition Helpers
    // ========================================================================

    /** 重置所有状态到空闲 */
    const resetToIdle = () => {
        phase.value = 'idle'
        status.value = 'paused'
        completedRoundCount = 0
        autoStartCount = 0
        const fd = pomodoroStore.focusDuration
        totalSeconds.value = fd
        remainingSeconds.value = fd
        targetEndTime = 0
        pausedRemainingMs = 0
        breakWarningSent = false
    }

    /** 当前阶段完成后进入休息阶段（自动判断短休息/长休息） */
    const enterBreakPhase = () => {
        const long = isLongBreakDue()
        if (long) completedRoundCount = 0
        const nextPhase: TimerPhase = long ? 'longBreak' : 'break'
        const nextDuration = long
            ? pomodoroStore.longBreakDuration
            : pomodoroStore.breakDuration
        phase.value = nextPhase
        breakWarningSent = false
        totalSeconds.value = nextDuration
        remainingSeconds.value = nextDuration
        targetEndTime = Date.now() + nextDuration * 1000
        status.value = 'running'
        startInterval()
    }

    /** 进入专注阶段（用于自动开始） */
    const enterFocusPhase = () => {
        phase.value = 'focus'
        const fd = pomodoroStore.focusDuration
        totalSeconds.value = fd
        remainingSeconds.value = fd
        targetEndTime = Date.now() + fd * 1000
        status.value = 'running'
        startInterval()
    }

    /** 休息结束后判断是否自动开始下一轮专注 */
    const transitionToNextFocusOrIdle = () => {
        if (pomodoroStore.autoStartNextFocusSession) {
            if (autoStartCount >= pomodoroStore.autoStartNextFocusSessionCount) {
                autoStartCount = 0
                resetToIdle()
                return
            }
            autoStartCount++
            generateNewSessionId()
            enterFocusPhase()
        } else {
            resetToIdle()
        }
    }

    // ========================================================================
    // Phase Complete Handler
    // ========================================================================

    /**
     * 阶段完成处理
     * - focus 完成：创建记录 + 通知 + 自动进入休息（或 idle）
     * - break / longBreak 完成：递增轮次 + 通知 + 自动进入下一轮专注（或 idle）
     */
    const handlePhaseComplete = () => {
        stopInterval()

        if (phase.value === 'focus') {
            const total = totalSeconds.value
            const record = buildRecord(total)
            pomodoroStore.addRecord(record)
            sendNotification('专注完成', `已完成 ${formatMinutes(total)} 的专注，现在开始休息`)

            if (!pomodoroStore.autoRest) {
                resetToIdle()
            } else {
                enterBreakPhase()
            }
        } else if (phase.value === 'break' || phase.value === 'longBreak') {
            if (phase.value === 'break') {
                completedRoundCount++
            } else {
                completedRoundCount = 0
            }
            sendNotification('休息结束', '现在开始下一轮的专注计时')
            transitionToNextFocusOrIdle()
        }
    }

    // ========================================================================
    // Public Actions
    // ========================================================================

    /** 初始化（重置显示状态到空闲） */
    const initialize = () => {
        if (phase.value !== 'idle') return
        const fd = pomodoroStore.focusDuration
        totalSeconds.value = fd
        remainingSeconds.value = fd
        phase.value = 'idle'
        status.value = 'paused'
    }

    /**
     * 开始专注
     * @description 由 handleStart（UI 层）调用，开始前已处理 NueConfirm 等交互
     */
    const start = () => {
        if (phase.value !== 'idle') return
        const seconds = totalSeconds.value
        if (seconds < MIN_FOCUS_SECONDS) return

        generateNewSessionId()

        phase.value = 'focus'
        status.value = 'running'
        totalSeconds.value = pomodoroStore.focusDuration
        remainingSeconds.value = pomodoroStore.focusDuration
        targetEndTime = Date.now() + pomodoroStore.focusDuration * 1000
        startInterval()
    }

    /** 暂停当前阶段 */
    const pause = () => {
        if (status.value !== 'running') return
        status.value = 'paused'
        pausedRemainingMs = targetEndTime - Date.now()
        remainingSeconds.value = Math.max(0, Math.ceil(pausedRemainingMs / 1000))
        stopInterval()
    }

    /** 恢复暂停 */
    const resume = () => {
        if (status.value !== 'paused') return
        status.value = 'running'
        targetEndTime = Date.now() + pausedRemainingMs
        remainingSeconds.value = Math.max(0, Math.ceil(pausedRemainingMs / 1000))
        startInterval()
    }

    /**
     * 重置到空闲
     * @description 仅在暂停状态可重置（running 态需先暂停）
     */
    const reset = () => {
        if (phase.value === 'idle') return
        if (status.value === 'running') return
        stopInterval()
        pomodoroStore.clearCurrentSession()
        resetToIdle()
    }

    /**
     * 跳过当前阶段
     * - focus 跳过：创建部分记录 → 进入休息
     * - break 跳过：递增轮次 → 下一轮专注或 idle
     * - longBreak 跳过：重置轮次 → 下一轮专注或 idle
     */
    const skip = () => {
        if (phase.value === 'idle') return

        stopInterval()

        if (phase.value === 'focus') {
            const elapsed = calcElapsed()
            const record = buildRecord(elapsed)
            pomodoroStore.addRecord(record)
            generateNewSessionId()
            enterBreakPhase()
        } else if (phase.value === 'break') {
            completedRoundCount++
            transitionToNextFocusOrIdle()
        } else if (phase.value === 'longBreak') {
            completedRoundCount = 0
            transitionToNextFocusOrIdle()
        }
    }

    /**
     * 调整时间
     * @param delta 调整量（秒，通常 ±300）
     * - idle 态：更新默认专注时长并同步到 pomodoroStore
     * - running 态：调整剩余时间 + targetEndTime
     * - paused 态：调整剩余时间 + pausedRemainingMs
     */
    const adjustTime = (delta: number) => {
        if (phase.value === 'idle') {
            const newTotal = totalSeconds.value + delta
            if (newTotal < MIN_FOCUS_SECONDS || newTotal > MAX_FOCUS_SECONDS) return
            pomodoroStore.setFocusDuration(newTotal)
            totalSeconds.value = newTotal
            remainingSeconds.value = newTotal
        } else if (status.value === 'running') {
            const newRemaining = calcRemaining() + delta
            if (newRemaining <= 0) return
            remainingSeconds.value = newRemaining
            totalSeconds.value += delta
            targetEndTime = Date.now() + newRemaining * 1000
        } else if (status.value === 'paused') {
            const newRemaining = calcRemaining() + delta
            if (newRemaining <= 0) return
            remainingSeconds.value = newRemaining
            totalSeconds.value += delta
            pausedRemainingMs = newRemaining * 1000
        }
    }

    /**
     * 同步配置
     * @description 设置对话框关闭后调用，确保 idle 态显示最新的默认专注时长
     */
    const updateConfig = () => {
        if (phase.value === 'idle') {
            const fd = pomodoroStore.focusDuration
            totalSeconds.value = fd
            remainingSeconds.value = fd
        }
    }

    /**
     * 销毁（清理 interval 和事件监听）
     * @description 应用关闭或 logout 时调用
     */
    const destroy = () => {
        stopInterval()
        teardownVisibilityListener()
    }

    // ========================================================================
    // Initialize
    // ========================================================================
    setupVisibilityListener()
    initialize()

    // ========================================================================
    // Public API
    // ========================================================================
    return {
        // State
        phase,
        status,
        remainingSeconds,
        totalSeconds,
        isIdle,
        isRunning,

        // Actions
        start,
        pause,
        resume,
        reset,
        skip,
        adjustTime,
        updateConfig,
        destroy
    }
})

export default usePomodoroTimerStore
