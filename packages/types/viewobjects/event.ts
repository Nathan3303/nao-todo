export type EventVO = {
    id: string
    taskId: string
    name: string
    description: string
    isDone: boolean
    sortId: number
    createdAt?: string
    updatedAt?: string
}

export type CreateEventVO = {
    taskId: string
    name: string
    description?: string
}

export type UpdateEventVO = {
    name?: string
    description?: string
    isDone?: boolean
    sortId?: number
}

export type UpdateEventsVO = {
    eventId: string
    updateVO: UpdateEventVO
}
