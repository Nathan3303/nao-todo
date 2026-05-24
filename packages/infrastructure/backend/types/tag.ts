export type GetTagRes = {
    id: string
    name: string
    description: string
    color: string
    createdAt: string
    updatedAt: string
    sortId: number
}

export type ListTagRes = GetTagRes[]

export type CreateTagReq = {
    name: string
    description: string
    color: string
}

export type CreateTagRes = GetTagRes

export type UpdateTagReq = {
    id?: string
    name?: string
    description?: string
    color?: string
    sortId?: number
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

export type BatchUpdateTagReq = {
    tags: UpdateTagReq[]
}

export type BatchUpdateTagRes = {
    updatedCount: number
    tags: GetTagRes[]
}




