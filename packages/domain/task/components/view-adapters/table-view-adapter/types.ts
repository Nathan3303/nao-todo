import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { GetTasksOptions, TaskColumnOptions, TaskTagViewObject } from '../../../types'
import type { TaskUseCase } from '../../../usecases'
import type { TableLayoutConfig } from '../../table/types'
import type { ViewAdapterPropsBase } from '../types'

export type TableViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    dialogManager: DialogManager
    tags: TaskTagViewObject[]
    columns: TaskColumnOptions
    layoutConfig?: TableLayoutConfig
} & ViewAdapterPropsBase
