import type { NullableString, ViewObjectBase } from '@nao-todo/shared'

/**
 * Pomodoro 记录类型
 * @description 映射后端 uint8：1=timer(番茄专注), 2=focus(正计时)
 */
export type PomodoroType = 1 | 2

/**
 * 常用番茄专注视图对象
 */
export type PomodoroViewObject = ViewObjectBase & {
    type: PomodoroType
    name: string
    description: NullableString
    duration: number
    archivedAt: NullableString
    totalDuration: number
    // -- Others
    isArchived: boolean
}

/**
 * 创建常用番茄专注视图对象
 */
export type CreatePomodoroViewObject = {
    type: PomodoroViewObject['type']
    name: PomodoroViewObject['name']
    description: PomodoroViewObject['description']
    duration: PomodoroViewObject['duration']
}

/**
 * 更新常用番茄专注视图对象
 */
export type UpdatePomodoroViewObject = Partial<CreatePomodoroViewObject>

/**
 * Pomodoro 计时器设置视图对象
 * @description Pomodoro 计时器设置视图对象，包含 Pomodoro 的计时器设置。被 PomodoroTimerSettingDialog 使用
 */
export type PomodoroTimerSettingViewObject = {
    // 专注时间（秒）
    duration: number
    // 短休息时间（秒）
    breakDuration: number
    // 长休息时间（秒）
    longBreakDuration: number
    // 专注轮数
    sessionsUntilLongBreak: number
    // 自动开启下一次专注
    autoStartNextFocusSession: boolean
    // 自动开启下一次专注次数 - 用于自动停止专注
    autoStartNextFocusSessionCount: number
    // 自动休息
    autoRest: boolean
}

// --- Pomodoro Record ---

/**
 * Pomodoro 记录视图对象
 */
export type PomodoroRecordViewObject = ViewObjectBase & {
    sessionId: string
    pomodoroId: NullableString // 常用番茄专注ID
    type: PomodoroType
    taskId: string
    taskName: string
    description: NullableString
    startAt: string
    endAt: string
    duration: number
    note: NullableString
}

/**
 * 创建 Pomodoro 记录视图对象
 */
export type CreatePomodoroRecordViewObject = {
    sessionId: PomodoroRecordViewObject['sessionId']
    pomodoroId: PomodoroRecordViewObject['pomodoroId'] // 常用番茄专注ID
    type: PomodoroRecordViewObject['type']
    taskId: PomodoroRecordViewObject['taskId']
    taskName: PomodoroRecordViewObject['taskName']
    description: PomodoroRecordViewObject['description']
    startAt: PomodoroRecordViewObject['startAt']
    endAt: PomodoroRecordViewObject['endAt']
    duration: PomodoroRecordViewObject['duration']
    note: PomodoroRecordViewObject['note']
}

/**
 * 获取 Pomodoro 记录列表选项
 */
export type GetPomodoroRecordsOptions = {
    sessionId?: string
    pomodoroId?: string | null // 常用番茄专注ID
    type?: PomodoroType
    taskId?: string
    taskName?: string
    startTime?: string
    endTime?: string
    page?: number
    limit?: number
    sort?: string
}
