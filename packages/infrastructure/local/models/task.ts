import type { ModelBase } from './base'

export type TaskModel = ModelBase & {
    parentTaskId: string | null
    userId: string
    name: string
    description: string | null
    state: number
    priority: number
    startAt: string | null
    endAt: string | null
    projectId: string | null
    tags: string[]
    archivedAt: string | null
    starMarkAt: string | null
    givenUpAt: string | null
}
