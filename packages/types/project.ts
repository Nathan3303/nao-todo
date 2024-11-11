import type { GetRequestPageOptions } from './common'
import type { GetTodosOptions } from './todo'
import type { User } from './user'

type ProjectPreference = {
    viewType: string
    getTodosOptions: GetTodosOptions
    columns: unknown
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

type GetProjectsOptionsRaw = {
    title?: string
    description?: string
    isArrchived?: boolean
    isDeleted?: boolean
    sort?: {
        field: keyof Project
        order: 'asc' | 'desc'
    }
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
    GetProjectsOptions,
    UpdateProjectOptionsRaw,
    UpdateProjectOptions,
    CreateProjectOptions
}
