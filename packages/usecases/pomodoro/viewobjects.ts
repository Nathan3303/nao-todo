import type { NullableString, ViewObjectBase } from '../shares/types'

/**
 * Pomodoro 记录类型
 * @description 映射后端 uint8：0=timer(番茄钟), 1=focus(专注正计时)
 */
export type PomodoroType = 0 | 1

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





