import type { CreateTask } from "@nao-todo/types"

export type BuiltInProjectEntity = {
    id: string
    name: string
    icon: string
    description: string
    createTaskOptions: Partial<CreateTask> | (() => Partial<CreateTask>)
}

export type BuiltInProjectPreferenceValueObject = {
    projectId?: string
    viewType: string
    getTasksOptions: string
    columns: string
}