import type { ModelBase } from './base'

export type EventModel = ModelBase & {
    userId: string
    taskId: string
    name: string
    description: string | null
    isDone: boolean
    sortId: number
}

