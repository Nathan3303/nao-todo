export type TagEntity = {
    id: string
    name: string
    description: string
    color: string
    createdAt: string
    updatedAt: string
}

export const makeTagEntity = (): TagEntity => {
    return {
        id: '',
        name: '',
        description: '',
        color: 'transparent',
        createdAt: '',
        updatedAt: ''
    }
}

export type TagPreferenceEntity = {
    id?: string
    tagId?: string
    viewType: string
    getTasksOptions: string
    columns: string
}

export const makeTagPreferenceEntity = (): TagPreferenceEntity => {
    return {
        id: '',
        tagId: '',
        viewType: '',
        getTasksOptions: '',
        columns: ''
    }
}
