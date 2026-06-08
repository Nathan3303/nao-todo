import type { PomodoroType } from '@/views/index/pomodoro/types'

/**
 * Timer 阶段
 * @description Pomodoro 计时器的当前阶段
 * @enum idle 空闲
 * @enum focus 专注
 * @enum break 休息
 */
export type TimerPhase = 'idle' | 'focus' | 'break' | 'longBreak'

/**
 * Timer 运行状态
 */
export type TimerStatus = 'running' | 'paused'

/**
 * Timer 状态
 */
export interface TimerState {
    phase: TimerPhase
    status: TimerStatus
    remainingSeconds: number
    totalSeconds: number
}

/**
 * Timer 配置
 */
export interface TimerConfig {
    focusDuration: number
    breakDuration: number
    longBreakDuration: number
    sessionsUntilLongBreak: number
}

/**
 * 专注记录 ViewObject
 * @description 一次专注会话的记录
 */
export interface PomodoroRecordViewObject {
    sessionId: string
    taskId: string
    name: string
    type: PomodoroType
    startAt: string
    endAt: string
    duration: number
    note: string
}

/**
 * Timer 组件属性
 */
export type TimerProps = {
    // Timer 阶段
    phase: TimerPhase
    // Timer 运行状态
    isRunning: boolean
    // Timer 剩余时间（秒）
    remainingSeconds: number
    // Timer 总时间（秒）
    totalSeconds: number
    // Timer 任务名称
    taskName?: string
}

/**
 * Timer 组件事件
 */
export type TimerEmits = {
    // Timer 开始
    (e: 'start'): void
    // Timer 暂停
    (e: 'pause'): void
    // Timer 恢复
    (e: 'resume'): void
    // Timer 重置
    (e: 'reset'): void
    // Timer 跳过
    (e: 'skip'): void
    // Timer 调整时间
    (e: 'adjustTime', delta: number): void
}

