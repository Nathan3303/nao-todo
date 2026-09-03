import type { GetTasksOptions, TaskColumnOptions, ViewObjectBase } from '@nao-todo/shared'
import type { TagViewObject } from './tag'

// 标签偏好视图对象
export type TagPreferenceViewObject = ViewObjectBase & {
    tagId: TagViewObject['id']
    viewType: string
    getTasksOptions: Partial<GetTasksOptions>
    columns: TaskColumnOptions
}