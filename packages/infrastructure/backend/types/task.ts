export type GetTaskRes = {
    id: string
    projectId: string
    name: string
    description: string
    state: string
    priority: string
    startAt: string
    endAt: string
    tags: string[]
    createdAt: string
    updatedAt: string
    deletedAt: string | null
    isDeleted: boolean
    archivedAt: string | null
    isArchived: boolean
    starMarkAt: string | null
    isStarMarked: boolean
    givenUpAt: string | null
    isGivenUp: boolean
}

export type CreateTaskReq = {
    projectId?: string
    name: string
    description?: string
    state: string
    priority: string
    startAt?: string
    endAt: string
    tags: string[]
}

export type CreateTaskRes = GetTaskRes

export type UpdateTaskReq = {
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

export type UpdateTaskRes = { taskId: string }

export type ListTaskReq = {
    projectId?: string
    tagId?: string
    state?: string
    priority?: string
    startAt?: string
    endAt?: string
    isStarMarked?: boolean
    isDeleted?: boolean
    isGivenUp?: boolean
    page?: number
    limit?: number
    relativeDate?: string
    sort?: string
}

export type ListTaskRes = GetTaskRes[]
