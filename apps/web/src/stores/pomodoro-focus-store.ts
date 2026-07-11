import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nanoid } from 'nanoid'
import usePomodoroRecordsStore from '@/stores/pomodoro-view/pomodoro-records-store'
import {
    sendNotification,
    formatMinutes,
    buildPomodoroRecord,
    persistPomodoroRecord
} from '@/infrastructure/utils/pomodoro'
import useTimerDriver from '@/infrastructure/hooks/use-timer-driver'

/**
 * 全局正计时 Store
 * @description 将正计时引擎提取为 Pinia store 全局单例，
 *              使 setInterval 生命周期与 store 绑定，路由切换后计时器持续运行。
 *
 * 职责：
 * - 正计时引擎（setInterval tick、elapsed 累计）
 * - 用户控制（start / pause / resume / end / reset）
 * - 专注记录创建（用户点击「结束」时写入 usePomodoroRecordsStore）
 * - 与 Timer 倒计时互斥（启动时自动停掉对方）
 */
export const usePomodoroFocusStore = defineStore('PomodoroFocusStore', () => {
    // ========================================================================
    // Dependencies
    // ========================================================================
    const pomodoroStore = usePomodoroRecordsStore()

    // ========================================================================
    // Reactive State
    // ========================================================================
    const status = ref<'idle' | 'running' | 'paused'>('idle')
    const elapsedSeconds = ref(0)

    // ========================================================================
    // Internal Engine State（plain variables，非响应式）
    // ========================================================================
    let startTimestamp = 0
    let accumulatedMs = 0

    // 记录创建所需（持久化，end() 时读取）
    let sessionId: string | null = null
    let recordStartedAt: string | null = null

    // ========================================================================
    // Helper Functions
    // ========================================================================

    /** 计算当前累计毫秒数 */
    const calcTotalMs = (): number => {
        if (status.value === 'idle') return 0
        if (status.value === 'paused') return accumulatedMs
        return accumulatedMs + (Date.now() - startTimestamp)
    }

    /** 计算当前累计秒数 */
    const calcElapsedSeconds = (): number => Math.floor(calcTotalMs() / 1000)

    /** 构建一条正计时记录 CreatePomodoroRecordViewObject */
    const buildRecord = (elapsed: number) =>
        buildPomodoroRecord({
            sessionId: sessionId!,
            pomodoroId: pomodoroStore.currentPomodoroId,
            type: 2, // focus=2
            taskId: pomodoroStore.currentTaskId,
            taskName: pomodoroStore.currentTaskName,
            startAt: recordStartedAt!,
            duration: elapsed,
            note: pomodoroStore.noteText
        })

    /** 重置为 idle（保留累计） */
    const resetToIdle = () => {
        status.value = 'idle'
        elapsedSeconds.value = 0
        startTimestamp = 0
        accumulatedMs = 0
        sessionId = null
        recordStartedAt = null
    }

    // ========================================================================
    // Interval & Engine
    // ========================================================================

    // @driver 计时驱动（interval + visibility + destroy）
    const driver = useTimerDriver(
        () => tick(),
        () => status.value === 'running'
    )

    /**
     * 每 250ms 执行的 tick
     * - 更新 elapsedSeconds（基于 accumulatedMs + current segment）
     */
    const tick = () => {
        if (status.value !== 'running') return
        elapsedSeconds.value = calcElapsedSeconds()
    }

    // ========================================================================
    // Public Actions
    // ========================================================================

    /**
     * 开始正计时
     * @description 由 handleStart（UI 层）调用
     */
    const start = () => {
        if (status.value !== 'idle') return

        // 生成会话
        sessionId = nanoid()
        recordStartedAt = new Date().toISOString()
        pomodoroStore.setCurrentSession(
            pomodoroStore.currentTaskId,
            pomodoroStore.currentTaskName,
            sessionId,
            recordStartedAt
        )
        pomodoroStore.setNoteText('')

        // 请求通知权限
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }

        // 启动计时
        accumulatedMs = 0
        startTimestamp = Date.now()
        status.value = 'running'
        driver.start()
    }

    /** 暂停正计时 */
    const pause = () => {
        if (status.value !== 'running') return
        accumulatedMs += Date.now() - startTimestamp
        status.value = 'paused'
        elapsedSeconds.value = calcElapsedSeconds()
        driver.stop()
    }

    /** 恢复正计时 */
    const resume = () => {
        if (status.value !== 'paused') return
        startTimestamp = Date.now()
        status.value = 'running'
        driver.start()
    }

    /**
     * 结束正计时（创建记录并重置）
     * @description 用户点击「结束」按钮时调用
     */
    const end = () => {
        if (status.value === 'idle') return
        driver.stop()

        const elapsed =
            status.value === 'paused' ? Math.floor(accumulatedMs / 1000) : calcElapsedSeconds()

        const record = buildRecord(elapsed)
        persistPomodoroRecord(
            pomodoroStore.addRecord,
            record,
            '[PomodoroFocus] Failed to create record:'
        )

        sendNotification('正计时完成', `已完成 ${formatMinutes(elapsed)} 的正计时`)
        pomodoroStore.clearCurrentSession()
        resetToIdle()
    }

    /**
     * 取消正计时（不创建记录，直接重置）
     * @description 用户点击「取消」按钮时调用
     */
    const reset = () => {
        if (status.value === 'idle') return
        driver.stop()
        pomodoroStore.clearCurrentSession()
        resetToIdle()
    }

    /** 销毁（清理 interval 和事件监听） */
    const destroy = () => {
        driver.destroy()
    }

    // ========================================================================
    // Public API
    // ========================================================================
    return {
        // State
        status,
        elapsedSeconds,

        // Actions
        start,
        pause,
        resume,
        end,
        reset,
        destroy
    }
})

export default usePomodoroFocusStore

