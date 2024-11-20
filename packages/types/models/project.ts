import type { GetRequestPageOptions } from '../axios/common'
import type { GetTodosOptions, TodoColumnOptions } from './todo'
import type { User } from './user'

type ProjectPreference = {
    viewType: string
    getTodosOptions: GetTodosOptions
    columns: TodoColumnOptions
}

type Project = {
    id: string
    userId: User['id']
    title: string
    description: string
    state: number
    isArchived: boolean
    archivedAt: Date | null
    isDeleted: boolean
    DeletedAt: Date | null
    preference: ProjectPreference
    createdAt: Date
    updatedAt: Date
    _id?: string
}

type GetProjectOptionsRaw = {
    id?: Project['id']
    title?: string
    description?: string
}

type GetProjectsSortOptions = {
    field: keyof Project
    order: 'asc' | 'desc'
}

type GetProjectsOptionsRaw = {
    title?: string
    description?: string
    isArchived?: boolean
    isDeleted?: boolean
    sort?: GetProjectsSortOptions
}

type UpdateProjectOptionsRaw = {
    title?: string
    description?: string
    state?: number
    isArchived?: boolean
    isDeleted?: boolean
    preference?: ProjectPreference
}

type GetProjectOptions = GetProjectOptionsRaw

type GetProjectsOptions = GetProjectsOptionsRaw & GetRequestPageOptions

type UpdateProjectOptions = UpdateProjectOptionsRaw

type CreateProjectOptions = UpdateProjectOptions

export type {
    Project,
    ProjectPreference,
    GetProjectOptions,
    GetProjectsSortOptions,
    GetProjectsOptionsRaw,
    GetProjectsOptions,
    UpdateProjectOptionsRaw,
    UpdateProjectOptions,
    CreateProjectOptions
}
