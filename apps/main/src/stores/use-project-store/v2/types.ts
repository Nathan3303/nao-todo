type ProjectPreference = {
    viewType: string
    filterInfo: unknown
    sortInfo: unknown
    columns: unknown
}

interface Project {
    id: string
    userId: string
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

type ResponseOptions = {
    toGetted?: boolean
}

type FetchProjectsPageOptions = {
    page: number
    limit: number
}

type FetchProjectsOptionsRaw = {
    title?: string
    description?: string
    isArrchived?: boolean
    isDeleted?: boolean
    sort?: { field: keyof Project; order: 'asc' | 'desc' }
}

type UpdateProjectOptionsRaw = {
    title?: string
    description?: string
    state?: number
    isArchived?: boolean
    isDeleted?: boolean
    preference?: ProjectPreference
}

type ResponseData = {
    code: number
    message: string
    data: unknown
}

type FetchProjectsOptions = FetchProjectsOptionsRaw & FetchProjectsPageOptions & ResponseOptions

type UpdateProjectOptions = UpdateProjectOptionsRaw & ResponseOptions

type DeleteProjectOptions = {} & ResponseOptions

type CreateProjectOptions = UpdateProjectOptions

type Intersection<T, K> = T extends K ? T : never

export type {
    Project,
    ProjectPreference,
    FetchProjectsPageOptions,
    FetchProjectsOptions,
    UpdateProjectOptionsRaw,
    UpdateProjectOptions,
    DeleteProjectOptions,
    CreateProjectOptions,
    ResponseData,
    Intersection
}
