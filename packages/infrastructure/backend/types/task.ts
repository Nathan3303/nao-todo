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
    archivedAt: string | null
    starMarkAt: string | null
    givenUpAt: string | null
    // isDeleted: boolean
    // isArchived: boolean
    // isStarMarked: boolean
    // isGivenUp: boolean
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
