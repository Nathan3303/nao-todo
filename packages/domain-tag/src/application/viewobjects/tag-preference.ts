import type { GetTasksOptions, TaskColumnOptions } from '@nao-todo/shared/constants/task'
import type { ViewObjectBase } from '@nao-todo/shared/types'
import type { TagViewObject } from './tag'

// 标签偏好视图对象
export type TagPreferenceViewObject = ViewObjectBase & {
    tagId: TagViewObject['id']
    viewType: string
    getTasksOptions: Partial<GetTasksOptions>
    columns: TaskColumnOptions
}