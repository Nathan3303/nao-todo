import type { GetTasksOptions, TaskColumnOptions } from './task'

export type ProjectVO = {
    id: string
    icon?: string
    name: string
    description: string
    archivedAt: string
    isArchived: boolean
    deletedAt: string
    isDeleted: boolean
    createdAt?: string
    updatedAt?: string
    createTaskOptions?: { projectId: string }
}

export type ProjectPreferenceVO = {
    id?: string
    projectId?: string
    viewType: string
    getTasksOptions: GetTasksOptions
    columns: TaskColumnOptions
}

export type UpdateProjectVO = {
    icon?: string
    name?: string
    description?: string
    archivedAt?: string
}

export type CreateProjectVO = {
    icon?: string
    name: string
    description?: string
}
