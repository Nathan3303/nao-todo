// import type { TaskApp } from '@nao-todo/application/task'
import type {
    GetTasksOptions,
    GetTasksSortOptions,
    TagVO,
    TaskColumnOptions,
    TaskVO
} from '@nao-todo/types'
import type { ComputedRef } from 'vue'

export type TaskTableProps = {
    tags: TagVO[]
    tasks: TaskVO[]
    columns: TaskColumnOptions
    getOptions: GetTasksOptions
    loading: boolean
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: string) => string
}

export type TaskTableEmits = {
    (e: 'showTaskDetails', taskId: TaskVO['id']): void
    (e: 'showMultiSelectPanel', payload: TaskTableMultiSelectPayload): void
    (e: 'updateColumns', key: string, value: boolean): void
    (e: 'updateSortOptions', options: GetTasksSortOptions): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: TaskVO['id']): void
    (e: 'restoreTask', taskId: TaskVO['id']): void
}

export type TaskTableContext = {
    tasks: ComputedRef<TaskVO[]>
    columns: ComputedRef<TaskColumnOptions>
    getOptions: ComputedRef<GetTasksOptions>
    tags: ComputedRef<TagVO[]>
    tagBarClamped: ComputedRef<number>
    // states: ComputedRef<TaskTableVO>
    showTaskDetails: (taskId: TaskVO['id'], idx: number) => void
    updateColumns: (key: string, value: boolean) => void
    updateSortOptions: (options: GetTasksSortOptions) => void
    clearSortOptions: () => void
    deleteTask: (taskId: TaskVO['id']) => void
    restoreTask: (taskId: TaskVO['id']) => void
    getColumnLabel: (key: string) => string
    isTaskExpired: (task: TaskVO) => boolean
    isInMultiSelectRange: (idx: number) => boolean
    showMultiSelectPanel: (idx: number) => void
    clearMultiSelect: (fullCLear: boolean) => void
    getProjectName: (projectId: string) => string
    deleteOrRestore: (taskId: TaskVO['id'], isDelete: boolean) => void
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
