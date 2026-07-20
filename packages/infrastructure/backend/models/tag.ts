import type { ResponseBase } from './base'

// --- Tag ---

export type TagRes = ResponseBase & {
    userId: string
    name: string
    description: string
    color: string
    sortId: number
}

export type CreateTagReq = {
    name: string
    description: string
    color: string
}

export type CreateTagRes = TagRes

export type UpdateTagReq = {
    id?: string
    name?: string
    description?: string
    color?: string
    sortId?: number
}

export type BatchUpdateTagReq = {
    tags: UpdateTagReq[]
}

export type BatchUpdateTagRes = {
    updatedCount: number
    tags: TagRes[]
}

export type ListTagRes = TagRes[]

// --- Tag Preference ---

export type TagPreferenceRes = ResponseBase & {
    tagId: string
    viewType: string
    getTasksOptions: string
    columns: string
}

export type UpdateTagPreferenceReq = {
    viewType: string
    getTasksOptions: string
    columns: string
}

