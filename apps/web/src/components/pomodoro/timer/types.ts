import type { PomodoroType } from '@/views/index/pomodoro/types'

/**
 * Timer 阶段
 * @description Pomodoro 计时器的当前阶段
 * @enum idle 空闲
 * @enum focus 专注
 * @enum break 休息
 */
export type TimerPhase = 'idle' | 'focus' | 'break'

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
}

/**
 * 专注记录 ViewObject
 * @description 一次专注会话的记录
 */
export interface PomodoroRecordViewObject {
    id: string
    taskId: string
    name: string
    type: PomodoroType
    startAt: string
    endAt: string
    duration: number
    note: string
}
