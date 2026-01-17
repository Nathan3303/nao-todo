import type { CreateTaskVO } from "@nao-todo/types"

export type BuiltInProjectEntity = {
    id: string
    name: string
    icon: string
    description: string
    createTaskOptions: Partial<CreateTaskVO>
}

export type BuiltInProjectPreferenceValueObject = {
    projectId?: string
    viewType: string
    getTasksOptions: string
    columns: string
}