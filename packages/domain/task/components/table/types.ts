import type { ComputedRef } from 'vue'
import type { TaskViewObject, TaskTagViewObject } from '../../types'
import type { GetTasksOptions, GetTasksSortOptions, TaskColumnOptions } from '@nao-todo/shared'

export type TableColumnConfig = {
    key: keyof TaskColumnOptions
    label: string
    visible: boolean
    width: number | null
    minWidth: number
    maxWidth: number
    defaultWidth: number
}

export type TableLayoutConfig = {
    columns: TableColumnConfig[]
    tableId: string
    version: string
    updatedAt: string
}

export type ColumnReorderPayload = {
    fromIndex: number
    toIndex: number
}

export type ColumnResizePayload = {
    columnKey: keyof TaskColumnOptions
    newWidth: number
}

export type TaskTableProps = {
    tags: TaskTagViewObject[]
    tasks: TaskViewObject[]
    columns: TaskColumnOptions
    getOptions: GetTasksOptions
    loading: boolean
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: string) => string
    layoutConfig?: TableLayoutConfig
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
    (e: 'deleteTaskPermanently', taskId: TaskViewObject['id']): void
    (e: 'columnReorder', payload: ColumnReorderPayload): void
    (e: 'columnResize', payload: ColumnResizePayload): void
    (e: 'updateLayoutConfig', config: TableLayoutConfig): void
}

export type TaskTableContext = {
    tasks: ComputedRef<TaskViewObject[]>
    columns: ComputedRef<TaskColumnOptions>
    getOptions: ComputedRef<GetTasksOptions>
    tags: ComputedRef<TaskTagViewObject[]>
    tagBarClamped: ComputedRef<number>
    layoutConfig: ComputedRef<TableLayoutConfig | undefined>
    visibleColumns: ComputedRef<TableColumnConfig[]>
    pinnedColumn: ComputedRef<string | undefined>
    suppressDeletedStyle: ComputedRef<boolean>
    suppressGivenUpLabel: ComputedRef<boolean>
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
    deleteTaskPermanently: (taskId: TaskViewObject['id']) => void
    getColumnLabel: (key: string) => string
    isTaskExpired: (task: TaskViewObject) => boolean
    isInMultiSelectRange: (idx: number) => boolean
    showMultiSelectPanel: (idx: number) => void
    clearMultiSelect: (fullCLear: boolean) => void
    getProjectName: (projectId: string) => string
    deleteOrRestore: (taskId: TaskViewObject['id'], isDelete: boolean) => void
    columnReorder: (payload: ColumnReorderPayload) => void
    columnResize: (payload: ColumnResizePayload) => void
    resetTableConfig: () => void
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
