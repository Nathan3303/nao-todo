import type { GetTasksOptions, TaskColumnOptions } from './task'

export type Tag = {
    id: string
    name: string
    description: string
    color: string
    createdAt?: string
    updatedAt?: string
}

export type TagPreference = {
    id?: string
    tagId?: string
    viewType: string
    getTasksOptions: GetTasksOptions
    columns: TaskColumnOptions
}

export type CreateTag = {
    name: string
    description?: string
    color?: string
}

export type UpdateTag = {
    name?: string
    description?: string
    color?: string
}
