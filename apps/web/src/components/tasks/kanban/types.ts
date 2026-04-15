import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type {
    GetTasksSortOptions,
    TagViewObject,
    TaskColumnOptions,
    TaskViewObject
} from '@nao-todo/types'
import type { ComputedRef } from 'vue'

/**
 * Task Kanban
 */

export type TaskKanbanVO = {
    currentGroupBy: 'state' | 'priority'
    kanbanColumns: string[]
}

export type TaskKanbanProps = {
    tags: TagViewObject[]
    tasks: TaskViewObject[]
    columns: TaskColumnOptions
    sortOptions: GetTasksSortOptions
    taskUseCase: TaskUseCase
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: TaskViewObject['projectId']) => string
}

export type TaskKanbanEmits = {
    (e: 'showTaskDetails', taskId: TaskViewObject['id']): void
    (e: 'updateColumns', key: keyof TaskColumnOptions, value: boolean): void
    (
        e: 'updateSortOptions',
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: TaskViewObject['id']): void
    (e: 'restoreTask', taskId: TaskViewObject['id']): void
    (e: 'finishTask', taskId: TaskViewObject['id']): void
    (e: 'unfinishTask', taskId: TaskViewObject['id']): void
}

export type TaskKanbanContext = {
    emit: TaskKanbanEmits
    tags: ComputedRef<TagViewObject[]>
    columns: ComputedRef<TaskColumnOptions>
    sortOptions: ComputedRef<GetTasksSortOptions>
    getProjectName: TaskKanbanProps['projectNameGetter']
    getColumnLabel: TaskKanbanProps['columnLabelGetter']
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    deleteTask: (taskId: TaskViewObject['id']) => void
    restoreTask: (taskId: TaskViewObject['id']) => void
    finishTask: (taskId: TaskViewObject['id']) => void
    unfinishTask: (taskId: TaskViewObject['id']) => void
    deleteOrRestore: (taskId: TaskViewObject['id'], isDeleted: boolean) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ) => void
    clearSortOptions: () => void
}

/**
 * Task Kanban Column
 */

export type TaskKanbanColumnProps = {
    category: string
    columns: TaskColumnOptions
    disabled?: boolean
    displayable?: boolean
    tasks: TaskViewObject[]
}

/**
 * Task Kanban Column Item
 */

export type TaskKanbanColumnItemProps = {
    task: TaskViewObject
    tags: TagViewObject[]
    actived?: boolean
    columns?: TaskColumnOptions
}

export type TaskKanbanColumnItemEmits = {
    (event: 'click', taskId: TaskViewObject['id']): void
    (event: 'delete', taskId: TaskViewObject['id']): void
    (event: 'restore', taskId: TaskViewObject['id']): void
    (event: 'finish', taskId: TaskViewObject['id']): void
    (event: 'unfinish', taskId: TaskViewObject['id']): void
    (event: 'heart', taskId: TaskViewObject['id']): void
}

