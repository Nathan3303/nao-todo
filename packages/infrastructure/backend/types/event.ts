export type GetEventRes = {
    id: string
    taskId: string
    name: string
    description: string
    isDone: boolean
    sortId: number
}

export type CreateEventReq = {
    taskId: string
    name: string
    description: string
}

export type CreateEventRes = GetEventRes

export type UpdateEventReq = {
    name?: string
    description?: string
    isDone?: boolean
    sortId?: number
}

export type UpdateEventRes = { eventId: string }

export type ListEventRes = GetEventRes[]
