import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { TaskUseCase } from '@nao-todo/usecases/task'
import type { GetTasksOptions, TaskColumnOptions } from '@nao-todo/usecases/task'
import type { ViewAdapterPropsBase } from '../types'
import type { TagViewObject } from '@nao-todo/usecases/tag'

export type KanbanViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    tags: TagViewObject[]
    columns: TaskColumnOptions
} & ViewAdapterPropsBase

