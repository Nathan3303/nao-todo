import type {
    DialogManager,
    GetTasksOptions,
    Subscriber,
    TaskColumnOptions
} from '@nao-todo/shared'
import type { TaskTagViewObject } from '@nao-todo/domain-task'
import type { TaskUseCase } from '@nao-todo/domain-task'
import type { ViewAdapterPropsBase } from '../../view-adapters/types'

export type KanbanViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    dialogManager: DialogManager
    tags: TaskTagViewObject[]
    columns: TaskColumnOptions
    /**
     * 多选清除信号
     * @description 与列表/表格视图保持一致，看板视图暂不支持多选，该属性仅透传占位
     */
    multiSelectClearSignal?: number
} & ViewAdapterPropsBase