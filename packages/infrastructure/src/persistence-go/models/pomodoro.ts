/**
 * Pomodoro 记录后端 API 请求/响应类型
 * @description 映射 Go 后端结构体
 */

import type { ListRequestBase, ResponseBase } from './base'

// --- Pomodoro ---

// PomodoroRes 常用番茄工作响应
export type PomodoroRes = ResponseBase & {
    type: number // uint8: 1=timer, 2=focus
    name: string
    description: string | null
    duration: number
    archivedAt: string | null
    totalDuration: number
}

// CreatePomodoroReq 创建番茄工作请求
export type CreatePomodoroReq = {
    type: number // uint8: 1=timer, 2=focus
    name: string
    description: string | null
    duration: number
}

// CreatePomodoroRes 创建番茄工作响应
export type CreatePomodoroRes = PomodoroRes

// UpdatePomodoroReq 更新常用番茄工作请求
export type UpdatePomodoroReq = {
    type?: number // uint8: 1=timer, 2=focus
    name?: string
    description?: string | null
    duration?: number
    archivedAt?: string | null
}

// ListPomodoroReq 获取常用番茄工作列表请求
export type ListPomodoroReq = {
    type?: number // uint8: 1=timer, 2=focus
    name?: string
    isArchived?: boolean
} & ListRequestBase

// ListPomodoroRes 获取常用番茄工作列表响应
export type ListPomodoroRes = PomodoroRes[]

// --- Pomodoro Record ---

// PomodoroRecordRes 番茄记录响应
export type PomodoroRecordRes = ResponseBase & {
    sessionId: string
    pomodoroId: string // 常用番茄专注ID
    type: number
    taskId: string
    taskName: string
    description: string
    startAt: string
    endAt: string
    duration: number
    note: string
}

// CreatePomodoroRecordReq 创建番茄记录请求
export type CreatePomodoroRecordReq = {
    sessionId: string
    pomodoroId: string // 常用番茄专注ID
    type: number // uint8: 1=timer, 2=focus
    taskId: string
    taskName: string
    description: string
    startAt: string
    endAt: string
    duration: number
    note: string
}

// CreatePomodoroRecordRes 创建番茄记录响应
export type CreatePomodoroRecordRes = PomodoroRecordRes

// ListPomodoroRecordReq 获取番茄记录列表请求
export type ListPomodoroRecordReq = {
    sessionId?: string
    pomodoroId?: string | null // 常用番茄专注ID
    startTime?: string
    endTime?: string
    taskId?: string
    taskName?: string
    type?: number
    page?: number
    limit?: number
    sort?: string
}

// ListPomodoroRecordRes 获取番茄记录列表响应
export type ListPomodoroRecordRes = PomodoroRecordRes[]