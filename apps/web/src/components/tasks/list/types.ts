import type { ComputedRef } from 'vue'
import type {
    TaskViewObject,
    TagViewObject,
    TaskColumnOptions,
    GetTasksSortOptions
} from '@nao-todo/types'

export type TaskListProps = {
    tags: TagViewObject[]
    tasks: TaskViewObject[]
    columns: TaskColumnOptions
    sortOptions: GetTasksSortOptions
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: string) => string
    disabledNextPage: boolean
    loading: boolean
    error: string | null
    // taskLister: TaskApp['list']
}

export type TaskListEmits = {
    (e: 'showTaskDetails', taskId: TaskViewObject['id']): void
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
    tags: ComputedRef<TagViewObject[]>
    tasks: ComputedRef<TaskViewObject[]>
    tagBarClamped: ComputedRef<number>
    showTaskDetails: (taskId: TaskViewObject['id'], idx: number) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ) => void
    clearSortOptions: () => void
    deleteTask: (taskId: TaskViewObject['id']) => void
    restoreTask: (taskId: TaskViewObject['id']) => void
    deleteTaskPermanently: (taskId: TaskViewObject['id']) => void
    getColumnLabel: (key: string) => string
    isTaskExpired: (task: TaskViewObject) => boolean
    isInMultiSelectRange: (idx: number) => boolean
    showMultiSelectPanel: (idx: number) => void
    clearMultiSelect: (fullCLear: boolean) => void
    getProjectName: (projectId: string) => string
    deleteOrRestore: (taskId: TaskViewObject['id'], isDelete: boolean) => void
}

export type TaskListMultiSelectPayload = {
    selectedIds: TaskViewObject['id'][]
    selectRange: { start: number; end: number; original: number }
}

export type TaskListOrderButtonProps = {
    prop: GetTasksSortOptions['field']
    text?: string
}

