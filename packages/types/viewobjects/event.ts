export type Event = {
    id: string
    taskId: string
    name: string
    description: string
    isDone: boolean
    sortId: number
    createdAt?: string
    updatedAt?: string
}

export type CreateEvent = {
    taskId: string
    name: string
    description?: string
}

export type UpdateEvent = {
    name?: string
    description?: string
    isDone?: boolean
    sortId?: number
}

export type UpdateEvents = {
    eventId: string
    updateVO: UpdateEvent
}
