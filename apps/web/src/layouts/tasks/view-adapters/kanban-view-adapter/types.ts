import type { Subscriber } from "@/infrastructure/hooks/use-subscriber"
import type { TaskUseCase } from "@nao-todo/application/web/usecases/task"
import type { GetTasksOptions, Project, Tag, TaskColumnOptions } from "@nao-todo/types"

export type KanbanViewAdapterProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
    subscriber: Subscriber
    tags: Tag[]
    columns: TaskColumnOptions
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: Project['id']) => string
    showTaskDetails: () => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (field: string, order: string) => void
    clearSortOptions: () => void
}
