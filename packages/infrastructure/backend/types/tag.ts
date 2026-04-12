export type GetTagRes = {
    id: string
    name: string
    description: string
    color: string
    preference: any
}

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

export type UpdateTagRes = { tagId: string }

export type ListTagRes = GetTagRes[]

export type GetTagPreferenceRes = {
    viewType: string
    getTasksOptions: string
    columns: string
}

export type UpdateTagPreferenceReq = {
    viewType: string
    getTasksOptions: string
    columns: string
}

export type UpdateTagPreferenceRes = {
    tagId: string
}

