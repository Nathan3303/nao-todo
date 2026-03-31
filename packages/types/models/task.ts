import type { ModelBase } from './base'

export type Task = ModelBase & {
    parentTaskId: string | null
    userId: string
    name: string
    description: string
    state: number
    priority: number
    startAt: string
    endAt: string
    projectId: string
    tags: string[]
    archivedAt: string | null
    starMarkAt: string | null
    givenUpAt: string | null
}
