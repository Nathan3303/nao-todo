import type { GetTasksOptions, TaskColumnOptions } from './task'

export type ProjectViewObject = {
    id: string
    userId: string
    icon?: string
    name: string
    description?: string
    archivedAt?: string
    deactivedAt?: string
    preference: ProjectPreferenceViewObject
    isArchived: boolean
    isDeleted: boolean
    createdAt: string
    updatedAt: string
    deletedAt?: string
    createTaskOptions?: { projectId: string }
}

export type ProjectPreferenceViewObject = {
    userId: string
    projectId: string
    getOptions: string
    viewType: string
    getTasksOptions: GetTasksOptions
    columns: TaskColumnOptions
}

export type UpdateProjectViewObject = {
    icon?: string
    name?: string
    description?: string
    archivedAt?: string
}

export type CreateProjectViewObject = {
    icon?: string
    name: string
    description?: string
}

