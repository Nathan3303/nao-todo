import type { CreateTaskVO } from '@nao-todo/types'

export type BuiltInProject = {
    id: string
    icon: string
    name: string
    description: string
    createTaskOptions: Partial<CreateTaskVO> | (() => Partial<CreateTaskVO>)
}

export type BuiltInProjectPreference = {
    projectId: BuiltInProject['id']
    userId: string
    viewType: string
    getTasksOptions: string
    columns: string
}
