export type EventViewObject = {
    id: string
    taskId: string
    name: string
    description: string
    isDone: boolean
    sortId: number
    createdAt?: string
    updatedAt?: string
}

export type CreateEventViewObject = {
    taskId: string
    name: string
    description?: string
}

export type UpdateEventViewObject = {
    name?: string
    description?: string
    isDone?: boolean
    sortId?: number
}

export type UpdateEventsViewObject = {
    eventId: string
    updateVO: UpdateEventViewObject
}
