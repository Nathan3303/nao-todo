export type GetTagRes = {
    id: string
    name: string
    description: string
    color: string
    createdAt: string
    updatedAt: string
}

export type ListTagRes = GetTagRes[]

export type CreateTagReq = {
    name: string
    description: string
    color: string
}

export type CreateTagRes = GetTagRes

export type UpdateTagReq = {
    name?: string
    description?: string
    color?: string
}

export type UpdateTagRes = GetTagRes['id']

export type DeleteTagRes = UpdateTagRes

export type GetTagPreferenceRes = {
    id: string
    tagId: string
    viewType: string
    getTasksOptions: string
    columns: string
    createdAt: string
    updatedAt: string
}

export type UpdateTagPreferenceReq = {
    viewType: string
    getTasksOptions: string
    columns: string
}

export type UpdateTagPreferenceRes = UpdateTagRes




