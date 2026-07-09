import type { NullableString, ViewObjectBase } from '../shares/types'

/**
 * Pomodoro 记录类型
 * @description 映射后端 uint8：1=timer(番茄专注), 2=focus(正计时)
 */
export type PomodoroType = 1 | 2

/**
 * Pomodoro 记录视图对象
 */
export type PomodoroRecordViewObject = ViewObjectBase & {
    sessionId: string
    type: PomodoroType
    taskId: NullableString
    taskName: NullableString
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
 * 获取 Pomodoro 记录列表选项
 */
export type GetPomodoroRecordsOptions = {
    sessionId?: string
    type?: PomodoroType
    taskId?: string
    taskName?: string
    startTime?: string
    endTime?: string
    page?: number
    limit?: number
    sort?: string
}





