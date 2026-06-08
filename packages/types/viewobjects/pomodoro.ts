/**
 * Pomodoro 记录类型
 * @description 映射后端 uint8：0=timer(番茄钟), 1=focus(专注正计时)
 */
export type PomodoroType = 0 | 1

/**
 * Pomodoro 记录视图对象
 */
export type PomodoroRecordViewObject = {
    id: string
    sessionId: string
    type: PomodoroType
    taskId: string
    taskName: string
    description: string
    startAt: string
    endAt: string
    duration: number
    note: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

/**
 * 创建 Pomodoro 记录视图对象
 */
export type CreatePomodoroRecordViewObject = {
    sessionId: string
    type: PomodoroType
    taskId: string
    taskName: string
    description?: string
    startAt: string
    endAt: string
    duration: number
    note?: string
}

/**
 * 获取 Pomodoro 记录列表选项
 */
export type GetPomodoroRecordsOptions = {
    sessionId?: string
    startTime?: string
    endTime?: string
    taskId?: string
    taskName?: string
    type?: PomodoroType
    page?: number
    limit?: number
    sort?: string
}
