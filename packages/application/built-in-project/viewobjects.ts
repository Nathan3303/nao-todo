import type { NullableDateString, GetTasksOptions, TaskColumnOptions } from '@nao-todo/shared'

// 内建项目存储接口
export type BuiltInProjectStore = {
    setBuiltInProjects: (projects: BuiltInProjectViewObject[]) => void
    setBuiltInProjectPreference: (preference: BuiltInProjectPreferenceViewObject) => void
    getBuiltInProjectPreference: () => BuiltInProjectPreferenceViewObject | undefined
    updatePreferenceColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updatePreferenceGetTasksOptions: <T extends keyof GetTasksOptions>(key: T, value: GetTasksOptions[T]) => void
    getPreferenceGetTasksOption: <T extends keyof GetTasksOptions>(key: T) => GetTasksOptions[T]
    getPreferenceGetTasksOptions: () => GetTasksOptions
}

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
    columns: TaskColumnOptions
}
