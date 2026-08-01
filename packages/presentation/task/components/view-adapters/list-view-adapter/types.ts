import type {
    DialogManager,
    GetTasksOptions,
    Subscriber,
    TaskColumnOptions
} from '@nao-todo/shared'
import type { TaskUseCase } from '@nao-todo/domain-task'
import type { TaskTagViewObject, TaskViewObject } from '@nao-todo/domain-task'
import type { ViewAdapterPropsBase } from '../../view-adapters/types'

export type ListViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    dialogManager: DialogManager
    tags: TaskTagViewObject[]
    columns: TaskColumnOptions
    small?: boolean
    taskClicked?: (task: TaskViewObject) => void
} & Omit<
    ViewAdapterPropsBase,
    'getColumnLabel' | 'updateColumns' | 'updateSortOptions' | 'clearSortOptions'
>