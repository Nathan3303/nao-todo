import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type {
    GetTasksOptions,
    TagViewObject,
    TaskColumnOptions,
    TaskViewObject
} from '@nao-todo/types'
import type { ViewAdapterPropsBase } from '../types'

export type ListViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    tags: TagViewObject[]
    columns: TaskColumnOptions
    small?: boolean
    taskClicked?: (task: TaskViewObject) => void
} & Omit<
    ViewAdapterPropsBase,
    'getColumnLabel' | 'updateColumns' | 'updateSortOptions' | 'clearSortOptions'
>

