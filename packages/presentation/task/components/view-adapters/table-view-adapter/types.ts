import type { DialogManager, GetTasksOptions, Subscriber, TaskColumnOptions } from '@nao-todo/shared'
import type { TaskTagViewObject } from '@nao-todo/application/task/viewobjects'
import type { TaskUseCase } from '@nao-todo/application/task/usecases'
import type { TableLayoutConfig } from '../../table/types'
import type { ViewAdapterPropsBase } from '../../view-adapters/types'

export type TableViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    dialogManager: DialogManager
    tags: TaskTagViewObject[]
    columns: TaskColumnOptions
    layoutConfig?: TableLayoutConfig
} & ViewAdapterPropsBase
