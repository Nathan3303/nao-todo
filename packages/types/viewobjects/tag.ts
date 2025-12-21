import type { GetTasksOptions, TaskColumnOptions } from './task'

export type TagVO = {
    id: string
    name: string
    description: string
    color: string
    createdAt?: string
    updatedAt?: string
}

export type TagPreferenceVO = {
    id?: string
    tagId?: string
    viewType: string
    getTasksOptions: GetTasksOptions
    columns: TaskColumnOptions
}
