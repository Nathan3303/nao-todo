export type GetProjectRes = {
    id: string
    name: string
    description: string
    archivedAt: string
    createdAt: string
    updatedAt: string
    deactivedAt: string | null
}

export type ListProjectRes = GetProjectRes[]

export type CreateProjectReq = {
    name: string
    description: string
}

export type CreateProjectRes = GetProjectRes

export type UpdateProjectReq = {
    name?: string
    description?: string
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

