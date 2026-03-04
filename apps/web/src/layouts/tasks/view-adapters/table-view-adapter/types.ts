import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { GetTasksOptions, Task, TaskColumnOptions } from '@nao-todo/types'
import type { Tag } from '@nao-todo/types'
import type { TaskTableProps } from '@/components/tasks/table/types'

export type TableViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    tags: Tag[]
    columns: TaskColumnOptions
    getColumnLabel: TaskTableProps['columnLabelGetter']
    getProjectName: TaskTableProps['projectNameGetter']
    showTaskDetails: (taskId: Task['id']) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (field: string, order: string) => void
    clearSortOptions: () => void
}
