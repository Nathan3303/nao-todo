import type { ModelBase } from './base'

export type Tag = ModelBase & {
    userId: string
    name: string
    description?: string
    color: string
    preference: TagPreference
}

export type TagPreference = ModelBase & {
    userId: string
    tagId: string
    viewType: string
    getOptions: string
    columns: string
}
