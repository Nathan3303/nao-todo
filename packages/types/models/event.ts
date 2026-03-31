import type { ModelBase } from './base'

export type Event = ModelBase & {
    userId: string
    taskId: string
    name: string
    description?: string
    isDone: boolean
    sortId: number
}
