import type { CreateTask, GetTasksOptions, TaskColumnOptions } from './task'

export type BuiltInProject = {
    id: string
    icon: string
    name: string
    description: string
    createTaskOptions: Partial<CreateTask> | (() => Partial<CreateTask>)
}

export type BuiltInProjectPreference = {
    projectId: string
    userId: string
    viewType: 'table' | 'kanban' | 'list'
    getTasksOptions: GetTasksOptions
    columns: TaskColumnOptions
}
