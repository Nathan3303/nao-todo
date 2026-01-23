import type { ComputedRef } from 'vue'
import type { Task, Tag, TaskColumnOptions, GetTasksSortOptions } from '@nao-todo/types'

export type TaskListProps = {
    tags: Tag[]
    tasks: Task[]
    columns: TaskColumnOptions
    sortOptions: GetTasksSortOptions
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: string) => string
    // taskLister: TaskApp['list']
}

export type TaskListEmits = {
    (e: 'showTaskDetails', taskId: Task['id']): void
    (e: 'showMultiSelectPanel', payload: TaskListMultiSelectPayload): void
    (e: 'updateColumns', key: string, value: boolean): void
    (e: 'updateSortOptions', newSortOptions: GetTasksSortOptions): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: Task['id']): void
    (e: 'restoreTask', taskId: Task['id']): void
}

export type TaskListContext = {
    columns: ComputedRef<TaskColumnOptions>
    sortOptions: ComputedRef<GetTasksSortOptions>
    tags: ComputedRef<Tag[]>
    tasks: ComputedRef<Task[]>
    tagBarClamped: ComputedRef<number>
    showTaskDetails: (taskId: Task['id'], idx: number) => void
    updateColumns: (key: string, value: boolean) => void
    updateSortOptions: (options: GetTasksSortOptions) => void
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
}

export type TaskListMultiSelectPayload = {
    selectedIds: Task['id'][]
    selectRange: { start: number; end: number; original: number }
}

export type TaskListOrderButtonProps = {
    prop: GetTasksSortOptions['field']
    text?: string
}
