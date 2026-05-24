import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { GetTasksOptions, TaskViewObject, TaskColumnOptions, TagViewObject } from '@nao-todo/types'
import type { TaskTableProps } from '@/components/tasks/table/types'

export type TableViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    tags: TagViewObject[]
    columns: TaskColumnOptions
    getColumnLabel: TaskTableProps['columnLabelGetter']
    getProjectName: TaskTableProps['projectNameGetter']
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (field: string, order: string) => void
    clearSortOptions: () => void
}
