import type { Project, ProjectPreference } from '../models'
import type { GetTasksOptions, TaskColumnOptions } from './task'

export type ProjectViewObject = Omit<Project, 'preference'> & {
    isArchived: boolean
    isDeleted: boolean
    createdAt: string
    updatedAt: string
    createTaskOptions?: { projectId: string }
}

export type ProjectPreferenceViewObject = Omit<ProjectPreference, 'getTasksOptions' | 'columns'> & {
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
