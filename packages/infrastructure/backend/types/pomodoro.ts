/**
 * Pomodoro 记录后端 API 请求/响应类型
 * @description 映射 Go 后端结构体
 */

export type CreatePomodoroReq = {
    sessionId: string
    type: number       // uint8: 0=timer, 1=focus
    taskId: string
    taskName: string
    description?: string
    startAt: string
    endAt: string
    duration: number
    note?: string
}

export type CreatePomodoroRes = {
    id: string
    sessionId: string
    type: number
    taskId: string
    taskName: string
    description: string
    startAt: string
    endAt: string
    duration: number
    note: string
    createdAt: string
    updatedAt: string
}

export type GetPomodoroRes = {
    id: string
    sessionId: string
    type: number
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

export type ListPomodoroReq = {
    sessionId?: string
    startTime?: string
    endTime?: string
    taskId?: string
    taskName?: string
    type?: number
    page?: number
    limit?: number
    sort?: string
}

export type ListPomodoroRes = GetPomodoroRes[]
