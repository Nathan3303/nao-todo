import type { ResponseBase } from './base'

// --- Project ---

export type ProjectRes = ResponseBase & {
    name: string
    description: string
    sortId: number
    archivedAt: string | null
    deactivedAt: string | null
}

export type CreateProjectReq = {
    name: string
    description: string
}

export type CreateProjectRes = ProjectRes

export type UpdateProjectReq = {
    id?: string
    name?: string
    description?: string
    sortId?: number
}

export type BatchUpdateProjectReq = {
    projects: ({ id: string } & UpdateProjectReq)[]
}

export type BatchUpdateProjectRes = {
    updatedCount: number
    projects: ProjectRes[]
}

export type ListProjectRes = ProjectRes[]

// --- Project Preference ---

export type ProjectPreferenceRes = ResponseBase & {
    projectId: string
    viewType: string
    getTasksOptions: string
    columns: string
}

export type UpdateProjectPreferenceReq = {
    viewType: string
    getTasksOptions: string
    columns: string
}