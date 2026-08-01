import type { ComputedRef } from 'vue'
import type { TaskViewObject, TaskTagViewObject } from '@nao-todo/domain-task'
import type { TaskColumnOptions, GetTasksSortOptions } from '@nao-todo/shared'

export type TaskListProps = {
    tags: TaskTagViewObject[]
    tasks: TaskViewObject[]
    columns: TaskColumnOptions
    sortOptions: GetTasksSortOptions
    projectNameGetter: (projectId: string) => string
    disabledNextPage: boolean
    loading: boolean
    error: string | null
    small?: boolean
    // taskLister: TaskApp['list']
}

export type TaskListEmits = {
    (e: 'showTaskDetails', taskId: TaskViewObject['id']): void
    (e: 'task-clicked', task: TaskViewObject): void
    (e: 'showMultiSelectPanel', payload: TaskListMultiSelectPayload): void
    (e: 'updateColumns', key: keyof TaskColumnOptions, value: boolean): void
    (
        e: 'updateSortOptions',
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: TaskViewObject['id']): void
    (e: 'restoreTask', taskId: TaskViewObject['id']): void
    (e: 'deleteTaskPermanently', taskId: TaskViewObject['id']): void
    (e: 'nextPage'): void
    (e: 'newTask'): void
}

export type TaskListContext = {
    columns: ComputedRef<TaskColumnOptions>
    sortOptions: ComputedRef<GetTasksSortOptions>
    tags: ComputedRef<TaskTagViewObject[]>
    tasks: ComputedRef<TaskViewObject[]>
    tagBarClamped: ComputedRef<number>
    small: ComputedRef<boolean>
    showTaskDetails: (taskId: TaskViewObject['id'], idx: number) => void
    deleteTask: (taskId: TaskViewObject['id']) => void
    restoreTask: (taskId: TaskViewObject['id']) => void
    deleteTaskPermanently: (taskId: TaskViewObject['id']) => void
    isTaskExpired: (task: TaskViewObject) => boolean
    isInMultiSelectRange: (idx: number) => boolean
    showMultiSelectPanel: (idx: number) => void
    clearMultiSelect: (fullCLear: boolean) => void
    getProjectName: (projectId: string) => string
    deleteOrRestore: (taskId: TaskViewObject['id'], isDelete: boolean) => void
    handleClickTask: (task: TaskViewObject, taskIdx: number) => void
}

export type TaskListMultiSelectPayload = {
    selectedIds: TaskViewObject['id'][]
    selectRange: { start: number; end: number; original: number }
}

export type TaskListOrderButtonProps = {
    prop: GetTasksSortOptions['field']
    text?: string
}