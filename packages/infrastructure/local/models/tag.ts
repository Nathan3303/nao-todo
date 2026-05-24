import type { ModelBase } from './base'

export type TagModel = ModelBase & {
    userId: string
    name: string
    description?: string
    color: string
    preference: TagPreferenceModel
}

export type TagPreferenceModel = ModelBase & {
    userId: string
    tagId: string
    viewType: string
    getOptions: string
    columns: string
}
