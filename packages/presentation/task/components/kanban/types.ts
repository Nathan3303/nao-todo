import type { ComputedRef } from 'vue'
import type { TaskTagViewObject, TaskViewObject } from '@nao-todo/application/task/viewobjects'
import type { GetTasksSortOptions, TaskColumnOptions } from '@nao-todo/shared'
import type { TaskUseCase } from '@nao-todo/application/task/usecases'

/**
 * Task Kanban
 */

export type TaskKanbanVO = {
    currentGroupBy: 'state' | 'priority'
    kanbanColumns: string[]
}

export type TaskKanbanProps = {
    tags: TaskTagViewObject[]
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
    tags: ComputedRef<TaskTagViewObject[]>
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
    updatingTaskIds: ComputedRef<Set<TaskViewObject['id']>>
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
    tags: TaskTagViewObject[]
    actived?: boolean
    columns?: TaskColumnOptions
    isUpdating?: boolean
}

export type TaskKanbanColumnItemEmits = {
    (event: 'click', taskId: TaskViewObject['id']): void
    (event: 'delete', taskId: TaskViewObject['id']): void
    (event: 'restore', taskId: TaskViewObject['id']): void
    (event: 'finish', taskId: TaskViewObject['id']): void
    (event: 'unfinish', taskId: TaskViewObject['id']): void
    (event: 'heart', taskId: TaskViewObject['id']): void
}
