import type { ModelBase } from './base'

export type ProjectModel = ModelBase & {
    userId: string
    icon?: string
    name: string
    description?: string
    archivedAt?: string
    deactivedAt?: string
    preference: ProjectPreferenceModel
}

export type ProjectPreferenceModel = ModelBase & {
    userId: string
    projectId: string
    viewType: string
    getOptions: string
    columns: string
}
