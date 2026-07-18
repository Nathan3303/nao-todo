/**
 * Pomodoro 类型
 * @description Pomodoro 类型，包括计时器和专注模式
 * @enum timer 番茄钟
 * @enum focus 专注正计时
 */
export type PomodoroType = 'timer' | 'focus'

/**
 * Pomodoro 状态
 * @description Pomodoro 状态，包括运行中和暂停中
 * @enum active 运行中
 * @enum paused 暂停中
 */
export type PomodoroStatus = 'active' | 'paused'

/**
 * Pomodoro 视图对象
 * @description Pomodoro 视图对象，包含 Pomodoro 的基本信息和状态
 */
export type PomodoroViewObject = {
    // Pomodoro 会话 ID
    sessionId: string
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