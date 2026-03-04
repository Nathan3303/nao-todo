import type {
    GetTasksOptions,
    GetTasksSortOptions,
    Tag,
    TaskColumnOptions,
    Task
} from '@nao-todo/types'
import type { ComputedRef } from 'vue'

export type TaskTableProps = {
    tags: Tag[]
    tasks: Task[]
    columns: TaskColumnOptions
    getOptions: GetTasksOptions
    loading: boolean
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: string) => string
}

export type TaskTableEmits = {
    (e: 'showTaskDetails', taskId: Task['id']): void
    (e: 'showMultiSelectPanel', payload: TaskTableMultiSelectPayload): void
    (e: 'updateColumns', key: keyof TaskColumnOptions, value: boolean): void
    (
        e: 'updateSortOptions',
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: Task['id']): void
    (e: 'restoreTask', taskId: Task['id']): void
}

export type TaskTableContext = {
    tasks: ComputedRef<Task[]>
    columns: ComputedRef<TaskColumnOptions>
    getOptions: ComputedRef<GetTasksOptions>
    tags: ComputedRef<Tag[]>
    tagBarClamped: ComputedRef<number>
    // states: ComputedRef<TaskTableVO>
    showTaskDetails: (taskId: Task['id'], idx: number) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ) => void
    clearSortOptions: () => void
    deleteTask: (taskId: Task['id']) => void
    restoreTask: (taskId: Task['id']) => void
    getColumnLabel: (key: string) => string
    isTaskExpired: (task: Task) => boolean
    isInMultiSelectRange: (idx: number) => boolean
    showMultiSelectPanel: (idx: number) => void
    clearMultiSelect: (fullCLear: boolean) => void
    getProjectName: (projectId: string) => string
    deleteOrRestore: (taskId: Task['id'], isDelete: boolean) => void
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

