import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type {
    GetTasksOptions,
    ProjectViewObject,
    TagViewObject,
    TaskViewObject,
    TaskColumnOptions
} from '@nao-todo/types'

export type ListViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    tags: TagViewObject[]
    columns: TaskColumnOptions
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: ProjectViewObject['id']) => string
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (field: string, order: string) => void
    clearSortOptions: () => void
}
