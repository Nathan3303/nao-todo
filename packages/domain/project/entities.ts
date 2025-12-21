export interface ProjectEntity {
    id: string
    name: string
    icon?: string
    description: string
    archivedAt: string
    createdAt: string
    updatedAt: string
}

export const makeProjectEntity = (): ProjectEntity => {
    return {
        id: '',
        name: '',
        description: '',
        archivedAt: '',
        createdAt: '',
        updatedAt: ''
    }
}

export interface ProjectPreferenceEntity {
    id?: string
    projectId?: string
    viewType: string
    getTasksOptions: string
    columns: string
}

export const makeProjectPreferenceEntity = (): ProjectPreferenceEntity => {
    return {
        id: '',
        projectId: '',
        viewType: '',
        getTasksOptions: '',
        columns: ''
    }
}
