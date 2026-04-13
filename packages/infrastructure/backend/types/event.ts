export type GetEventRes = {
    id: string
    taskId: string
    name: string
    isDone: boolean
    sortId: number
}

export type CreateEventReq = {
    taskId: string
    name: string
}

export type CreateEventRes = GetEventRes

export type UpdateEventReq = {
    name?: string
    isDone?: boolean
    sortId?: number
}

export type UpdateEventRes = string

export type ListEventRes = GetEventRes[]

