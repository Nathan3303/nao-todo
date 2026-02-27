export type UpdateTask = {
    projectId?: string
    name?: string
    description?: string
    state?: string
    priority?: string
    startAt?: string
    endAt?: string
    tags?: string[]
    isStarMarked?: boolean
}
