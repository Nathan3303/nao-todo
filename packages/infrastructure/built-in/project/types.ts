import type { CreateTaskViewObject } from '@nao-todo/types'

export type BuiltInProjectRes = {
    id: string
    icon: string
    name: string
    description: string
    createTaskOptions: (() => Partial<CreateTaskViewObject>) | Partial<CreateTaskViewObject>
}

export type BuiltInProjectPreferenceRes = {
    projectId: BuiltInProjectRes['id']
    userId: string
    viewType: string
    getTasksOptions: string
    columns: string
}

