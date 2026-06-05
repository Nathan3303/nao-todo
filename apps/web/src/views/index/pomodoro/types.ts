/**
 * Pomodoro 类型
 * @description Pomodoro 类型，包括计时器和专注模式
 * @enum timer 番茄钟
 * @enum focus 专注正计时
 */
export type PomodoroType = 'timer' | 'focus'

export type PomodoroStatus = 'active' | 'paused'

export type PomodoroViewObject = {
    // Pomodoro ID
    id: string
    // 任务 ID
    taskId: string
    // 任务名称
    name: string
    // Pomodoro 类型
    type: PomodoroType
    // Pomodoro 开始时间
    startAt: string
    // Pomodoro 结束时间
    endAt: string
    // Pomodoro 持续时间（秒）
    duration: number
    // 正在计时时间（秒）
    currentDuration: number
    // 是否跳过
    isSkipped: boolean
    // Pomodoro 状态
    status: PomodoroStatus
    // 专注笔记
    note: string
}

