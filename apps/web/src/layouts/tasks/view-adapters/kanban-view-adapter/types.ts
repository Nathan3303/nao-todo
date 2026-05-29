import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { GetTasksOptions, TagViewObject, TaskColumnOptions } from '@nao-todo/types'
import type { ViewAdapterPropsBase } from '../types'

export type KanbanViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    tags: TagViewObject[]
    columns: TaskColumnOptions
} & ViewAdapterPropsBase

