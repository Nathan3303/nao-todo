import type { NullableDateString, GetTasksOptions, TaskColumnOptions } from '@nao-todo/shared'

export type BuiltInProjectCreateTaskOptions = {
    startAt?: NullableDateString
    endAt?: NullableDateString
    projectId?: string
    isStarMarked?: boolean
}

// 内置项目视图对象
export type BuiltInProjectViewObject = {
    id: string
    icon: string
    name: string
    description: string
    createTaskOptions: (() => BuiltInProjectCreateTaskOptions) | BuiltInProjectCreateTaskOptions
}

// 内置项目偏好视图对象
export type BuiltInProjectPreferenceViewObject = {
    projectId: string
    userId: string
    viewType: string
    getTasksOptions: Partial<GetTasksOptions>
    columns: Partial<TaskColumnOptions>
}
