import { CreateTaskViewObject, GetTasksOptions, TaskColumnOptions } from '../task/viewobjects'

// 内置项目视图对象
export type BuiltInProjectViewObject = {
    id: string
    icon: string
    name: string
    description: string
    createTaskOptions: (() => Partial<CreateTaskViewObject>) | Partial<CreateTaskViewObject>
}

// 内置项目偏好视图对象
export type BuiltInProjectPreferenceViewObject = {
    projectId: string
    userId: string
    viewType: string
    getTasksOptions: Partial<GetTasksOptions>
    columns: Partial<TaskColumnOptions>
}

