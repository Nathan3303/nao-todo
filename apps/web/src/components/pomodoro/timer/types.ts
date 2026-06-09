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
 * Timer 组件属性
 */
export type TimerProps = {
    phase: TimerPhase
    isRunning: boolean
    remainingSeconds: number
    totalSeconds: number
    taskName?: string
}

/**
 * Timer 组件事件
 */
export type TimerEmits = {
    (e: 'start'): void
    (e: 'pause'): void
    (e: 'resume'): void
    (e: 'reset'): void
    (e: 'skip'): void
    (e: 'adjustTime', delta: number): void
}

