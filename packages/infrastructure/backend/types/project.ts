export type GetProjectRes = {
    id: string
    name: string
    description: string
    archivedAt: string
    createdAt: string
    updatedAt: string
    deactivedAt: string | null
    sortId: number
}

export type ListProjectRes = GetProjectRes[]

export type CreateProjectReq = {
    name: string
    description: string
}

export type CreateProjectRes = GetProjectRes

export type UpdateProjectReq = {
    id?: string
    name?: string
    description?: string
    sortId?: number
}

export type UpdateProjectRes = GetProjectRes['id']

export type DeleteProjectRes = UpdateProjectRes

export type RestoreProjectRes = DeleteProjectRes

export type ArchiveProjectRes = UpdateProjectRes

export type UnarchiveProjectRes = ArchiveProjectRes

export type GetProjectPreferenceRes = {
    id: string
    projectId: string
    viewType: string
    getTasksOptions: string
    columns: string
    createdAt: string
    updatedAt: string
}

export type UpdateProjectPreferenceReq = {
    viewType: string
    getTasksOptions: string
    columns: string
}

export type UpdateProjectPreferenceRes = UpdateProjectRes

export type BatchUpdateProjectReq = {
    projects: UpdateProjectReq[]
}

export type BatchUpdateProjectRes = {
    updatedCount: number
    projects: GetProjectRes[]
}

