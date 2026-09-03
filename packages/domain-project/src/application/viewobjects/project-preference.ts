import type { GetTasksOptions, TaskColumnOptions, ViewObjectBase } from '@nao-todo/shared'

// 项目偏好视图对象
export type ProjectPreferenceViewObject = ViewObjectBase & {
    // userId: string
    projectId: string
    viewType: string
    getTasksOptions: Partial<GetTasksOptions>
    columns: TaskColumnOptions
}