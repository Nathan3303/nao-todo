import type {
    DialogManager,
    GetTasksOptions,
    Subscriber,
    TaskColumnOptions
} from '@nao-todo/shared'
import type { TaskTagViewObject } from '@nao-todo/domain-task'
import type { TaskUseCase } from '@nao-todo/domain-task'
import type { TableLayoutConfig, TaskTableMultiSelectPayload } from '../../table/types'
import type { ViewAdapterPropsBase } from '../../view-adapters/types'

export type TableViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    dialogManager: DialogManager
    tags: TaskTagViewObject[]
    columns: TaskColumnOptions
    layoutConfig?: TableLayoutConfig
    /**
     * 多选清除信号
     * @description 透传给任务表格，外部递增时清空多选范围
     */
    multiSelectClearSignal?: number
} & ViewAdapterPropsBase

export type TableViewAdapterEmits = {
    (e: 'multiSelectChanged', payload: TaskTableMultiSelectPayload): void
}