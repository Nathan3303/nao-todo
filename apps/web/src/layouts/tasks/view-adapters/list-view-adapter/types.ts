import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { GetTasksOptions, Project, Tag, Task, TaskColumnOptions } from '@nao-todo/types'

export type ListViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    tags: Tag[]
    columns: TaskColumnOptions
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: Project['id']) => string
    showTaskDetails: (taskId: Task['id']) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (field: string, order: string) => void
    clearSortOptions: () => void
}
