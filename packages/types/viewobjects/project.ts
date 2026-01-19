import type { GetTasksOptions, TaskColumnOptions } from './task'

export type Project = {
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

export type ProjectPreference = {
    id?: string
    projectId?: string
    viewType: string
    getTasksOptions: GetTasksOptions
    columns: TaskColumnOptions
}

export type UpdateProject = {
    icon?: string
    name?: string
    description?: string
    archivedAt?: string
}

export type CreateProject = {
    icon?: string
    name: string
    description?: string
}
