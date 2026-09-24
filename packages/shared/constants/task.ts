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
    /**
     * 包含已归档（ADR `docs/adr/2026-09-24-project-archive.md` §15.2）
     * @description true ⇒ **不按归档态过滤**（包含已归档）；**优先级高于 `isArchived`**
     *              （L1 使「未传 isArchived」= 排除 ⇒「包含」必须用正向信号）；
     *              **web-only**（服务端无该参数）。
     */
    includeArchived?: boolean
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