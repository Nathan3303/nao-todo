import type { ComputedRef } from 'vue'
import type { TaskVO, TagVO, TaskColumnOptions, GetTasksSortOptions } from '@nao-todo/types'
import type { TaskApp } from '@nao-todo/application/task'

export type TaskListProps = {
    tags: TagVO[]
    tasks: TaskVO[]
    columns: TaskColumnOptions
    sortOptions: GetTasksSortOptions
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: string) => string
    taskLister: TaskApp['list']
}

export type TaskListEmits = {
    (e: 'showTaskDetails', taskId: TaskVO['id']): void
    (e: 'showMultiSelectPanel', payload: TaskListMultiSelectPayload): void
    (e: 'updateColumns', key: string, value: boolean): void
    (e: 'updateSortOptions', newSortOptions: GetTasksSortOptions): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: TaskVO['id']): void
    (e: 'restoreTask', taskId: TaskVO['id']): void
}

export type TaskListContext = {
    columns: ComputedRef<TaskColumnOptions>
    sortOptions: ComputedRef<GetTasksSortOptions>
    tags: ComputedRef<TagVO[]>
    tasks: ComputedRef<TaskVO[]>
    tagBarClamped: ComputedRef<number>
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
}

export type TaskListMultiSelectPayload = {
    selectedIds: TaskVO['id'][]
    selectRange: { start: number; end: number; original: number }
}

export type TaskListOrderButtonProps = {
    prop: GetTasksSortOptions['field']
    text?: string
}
