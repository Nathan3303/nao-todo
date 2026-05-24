export type GetTaskRes = {
    id: string
    parentTaskId: string
    name: string
    description: string
    state: string
    priority: string
    startAt: string
    endAt: string
    tags: string[]
    projectId: string
    archivedAt: string
    starMarkAt: string
    givenUpAt: string
    createdAt: string
    updatedAt: string
    deletedAt: string
    remindAt: string
    remindRepeat: string
    remindTime: string
    remindWeekdays: number[]
}

export type CreateTaskReq = {
    parentTaskId?: string
    name: string
    description?: string
    state: string
    priority: string
    startAt?: string
    endAt?: string
    projectId?: string
    tags?: string[]
    remindAt?: string
    remindRepeat?: string
    remindTime?: string
    remindWeekdays?: number[]
}

export type CreateTaskRes = GetTaskRes

export type UpdateTaskReq = {
    projectId?: string
    name?: string
    description?: string
    state?: string
    priority?: string
    startAt?: string | null
    endAt?: string | null
    tags?: string[]
    isStarMarked?: boolean
    givenUpAt?: string | null
    remindAt?: string | null
    remindRepeat?: string
    remindTime?: string | null
    remindWeekdays?: number[]
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

export type SnoozeTaskReq = {
    durationMinutes: number
}

export type SnoozeTaskRes = {
    remindAt: string
}

