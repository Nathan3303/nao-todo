import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { TaskUseCase } from '../../../usecases'
import type {
    GetTasksOptions,
    TaskTagViewObject,
    TaskColumnOptions,
    TaskViewObject
} from '../../../types'
import type { ViewAdapterPropsBase } from '../types'

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
