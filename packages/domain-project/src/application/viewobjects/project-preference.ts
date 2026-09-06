import type { GetTasksOptions, TaskColumnOptions } from '@nao-todo/shared/constants/task'
import type { ViewObjectBase } from '@nao-todo/shared/types'

// 项目偏好视图对象
export type ProjectPreferenceViewObject = ViewObjectBase & {
    // userId: string
    projectId: string
    viewType: string
    getTasksOptions: Partial<GetTasksOptions>
    columns: TaskColumnOptions
}