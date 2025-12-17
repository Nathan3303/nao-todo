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
