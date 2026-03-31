import type { GetTasksOptions, TaskColumnOptions } from './task'

export type BuiltInProjectViewObject = {
    id: string
    icon: string
    name: string
    description: string
    // createTaskOptions: Partial<CreateTaskViewObject> | (() => Partial<CreateTaskViewObject>)
}

export type BuiltInProjectPreferenceViewObject = {
    projectId: string
    userId: string
    viewType: string
    getTasksOptions: GetTasksOptions
    columns: TaskColumnOptions
}
