import type {
    GetTasksOptions,
    GetTasksSortOptions,
    TagViewObject,
    TaskColumnOptions,
    TaskViewObject
} from '@nao-todo/types'
import type { ComputedRef } from 'vue'

export type TaskTableProps = {
    tags: TagViewObject[]
    tasks: TaskViewObject[]
    columns: TaskColumnOptions
    getOptions: GetTasksOptions
    loading: boolean
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: string) => string
}

export type TaskTableEmits = {
    (e: 'showTaskDetails', taskId: TaskViewObject['id']): void
    (e: 'showMultiSelectPanel', payload: TaskTableMultiSelectPayload): void
    (e: 'updateColumns', key: keyof TaskColumnOptions, value: boolean): void
    (
        e: 'updateSortOptions',
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: TaskViewObject['id']): void
    (e: 'restoreTask', taskId: TaskViewObject['id']): void
}

export type TaskTableContext = {
    tasks: ComputedRef<TaskViewObject[]>
    columns: ComputedRef<TaskColumnOptions>
    getOptions: ComputedRef<GetTasksOptions>
    tags: ComputedRef<TagViewObject[]>
    tagBarClamped: ComputedRef<number>
    // states: ComputedRef<TaskTableVO>
    showTaskDetails: (taskId: TaskViewObject['id'], idx: number) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ) => void
    clearSortOptions: () => void
    deleteTask: (taskId: TaskViewObject['id']) => void
    restoreTask: (taskId: TaskViewObject['id']) => void
    getColumnLabel: (key: string) => string
    isTaskExpired: (task: TaskViewObject) => boolean
    isInMultiSelectRange: (idx: number) => boolean
    showMultiSelectPanel: (idx: number) => void
    clearMultiSelect: (fullCLear: boolean) => void
    getProjectName: (projectId: string) => string
    deleteOrRestore: (taskId: TaskViewObject['id'], isDelete: boolean) => void
    // handleUpdatePage: (page: number) => void
    // handleUpdatePerPage: (limit: number) => void
}

export type TaskTableMultiSelectPayload = {
    selectedIds: string[]
    selectRange: { start: number; end: number; original: number }
}

export type TaskTableOrderButtonProps = {
    prop: GetTasksSortOptions['field']
    text?: string
}

