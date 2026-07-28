import type { ListRequestBase, ResponseBase } from './base'

// --- Task ---

export type TaskRes = ResponseBase & {
    parentTaskId: string
    name: string
    description: string
    state: string
    priority: string
    startAt: string
    endAt: string
    tags: string[]
    projectId: string
    archivedAt: string | null
    starMarkAt: string | null
    givenUpAt: string | null
    remindAt: string | null
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

export type CreateTaskRes = TaskRes

export type UpdateTaskReq = {
    parentTaskId?: string
    name?: string
    description?: string
    state?: string
    priority?: string
    startAt?: string | null
    endAt?: string | null
    projectId?: string
    tags?: string[]
    isStarMarked?: boolean
    givenUpAt?: string | null
    remindAt?: string | null
    remindRepeat?: string
    remindTime?: string | null
    remindWeekdays?: number[]
}

export type ListTaskReq = {
    projectId?: string
    tagId?: string
    description?: string
    state?: string
    priority?: string
    startAt?: string
    endAt?: string
    archivedAt?: string
    starMarkAt?: string
    givenUpAt?: string
    isArchived?: boolean
    isStarMarked?: boolean
    isGivenUp?: boolean
    isDeleted?: boolean
    relativeDate?: string
} & ListRequestBase

export type ListTaskRes = TaskRes[]

// --- Task Check Item ---

export type TaskCheckItemRes = ResponseBase & {
    taskId: string
    name: string
    description: string | null
    isDone: boolean
    sortId: number
}

export type CreateTaskCheckItemReq = {
    taskId: string
    name: string
    description?: string | null
}

export type CreateTaskCheckItemRes = TaskCheckItemRes

export type UpdateTaskCheckItemReq = {
    id: string
    name?: string
    isDone?: boolean
    sortId?: number
}

export type ListTaskCheckItemRes = TaskCheckItemRes[]

export type BatchUpdateTaskCheckItemReq = {
    events: UpdateTaskCheckItemReq[]
}

export type BatchUpdateTaskCheckItemRes = {
    updatedCount: number
    events: TaskCheckItemRes[]
}

// --- Task Comment ---

export type TaskCommentRes = ResponseBase & {
    taskId: string
    content: string
    attachments: string[]
    isTopUp: boolean
    nickname: string
    avatar: string
}

export type CreateTaskCommentReq = {
    taskId: string
    content: string
}

export type CreateTaskCommentRes = TaskCommentRes

export type UpdateTaskCommentReq = {
    content?: string
    attachments?: string[]
    isTopUp?: boolean
}

export type ListTaskCommentRes = TaskCommentRes[]

// --- Task Reminder ---

export type SnoozeTaskReq = {
    durationMinutes: number
}

export type SnoozeTaskRes = {
    remindAt: string
}