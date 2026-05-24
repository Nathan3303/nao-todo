import type { GetTasksOptions, TaskColumnOptions } from './task'

export type TagViewObject = {
    id: string
    sortId: number
    name: string
    description: string
    color: string
    createdAt?: string
    updatedAt?: string
}

export type TagPreferenceViewObject = {
    id: string
    tagId: string
    viewType: string
    getTasksOptions: GetTasksOptions
    columns: TaskColumnOptions
}

export type CreateTagViewObject = {
    name: string
    description?: string
    color: string
    icon?: string
}

export type UpdateTagViewObject = {
    sortId?: number
    name?: string
    description?: string
    color?: string
}
