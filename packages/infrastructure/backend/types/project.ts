export type GetProjectRes = {
    id: string
    name: string
    description: string
    archivedAt: string
    preference: any
}

export type CreateProjectReq = {
    name: string
    description: string
}

export type CreateProjectRes = GetProjectRes

export type UpdateProjectReq = {
    name?: string
    description?: string
}

export type UpdateProjectRes = { projectId: string }

export type ListProjectRes = GetProjectRes[]

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

export type UpdateProjectPreferenceRes = {
    projectId: string
}

