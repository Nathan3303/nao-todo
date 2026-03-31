import type { ModelBase } from './base'

export type Project = ModelBase & {
    userId: string
    icon?: string
    name: string
    description?: string
    archivedAt?: string
    preference: ProjectPreference
}

export type ProjectPreference = ModelBase & {
    userId: string
    projectId: string
    viewType: string
    getOptions: string
    columns: string
}
