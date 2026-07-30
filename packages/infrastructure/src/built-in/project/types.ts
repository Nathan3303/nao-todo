import type { BuiltInProjectCreateTaskOptions } from '@nao-todo/domain-built-in-project'

// 内建清单响应
export type BuiltInProjectRes = {
    id: string
    icon: string
    name: string
    nameKey?: string
    description: string
    createTaskOptions: (() => BuiltInProjectCreateTaskOptions) | BuiltInProjectCreateTaskOptions
}

// 内建清单偏好响应
export type BuiltInProjectPreferenceRes = {
    projectId: BuiltInProjectRes['id']
    userId: string
    viewType: string
    getTasksOptions: string
    columns: string
}