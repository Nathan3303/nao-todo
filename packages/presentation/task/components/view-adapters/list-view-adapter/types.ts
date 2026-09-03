import type {
    DialogManager,
    GetTasksOptions,
    Subscriber,
    TaskColumnOptions
} from '@nao-todo/shared'
import type { TaskUseCase } from '@nao-todo/domain-task'
import type { TaskTagViewObject, TaskViewObject } from '@nao-todo/domain-task'
import type { TaskListMultiSelectPayload } from '../../list/types'
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
    /**
     * 多选清除信号
     * @description 透传给任务列表，外部递增时清空多选范围
     */
    multiSelectClearSignal?: number
} & Omit<
    ViewAdapterPropsBase,
    'getColumnLabel' | 'updateColumns' | 'updateSortOptions' | 'clearSortOptions'
>

export type ListViewAdapterEmits = {
    (e: 'multiSelectChanged', payload: TaskListMultiSelectPayload): void
}