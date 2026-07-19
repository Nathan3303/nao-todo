import type { NullableString } from '../types'

// 获取任务列表选项
export type GetTasksOptions = {
    parentTaskId?: string
    name?: string
    description?: string
    state?: string
    priority?: string
    projectId?: NullableString
    tagId?: string
    isArchived?: boolean
    isDeleted?: boolean
    isStarMarked?: boolean
    isGivenUp?: boolean
    sort?: GetTasksSortOptions
    relativeDate?: 'today' | 'tomorrow' | 'week' | '-today' | 'month' | '-overdue'
    page?: number
    limit?: number
}

// 获取任务列表排序选项
export type GetTasksSortOptions = { field: string; order: string }

// 任务列表列选项
export type TaskColumnOptions = {
    name: boolean
    description: boolean
    state: boolean
    priority: boolean
    startAt: boolean
    endAt: boolean
    project: boolean
    tags: boolean
    givenUpAt: boolean
    starMarkAt: boolean
    archivedAt: boolean
    createdAt: boolean
    updatedAt: boolean
    deletedAt: boolean
}

// 默认显示的列
export const defaultColumns: Record<keyof TaskColumnOptions, boolean> = {
    name: true,
    description: false,
    state: true,
    priority: true,
    startAt: false,
    endAt: true,
    project: true,
    tags: true,
    givenUpAt: false,
    starMarkAt: false,
    archivedAt: false,
    createdAt: false,
    updatedAt: true,
    deletedAt: false
}

