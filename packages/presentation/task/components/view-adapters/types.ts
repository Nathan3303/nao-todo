import type { TaskColumnOptions } from '@nao-todo/shared'
import type { TaskProjectViewObject, TaskViewObject } from '@nao-todo/domain-task'

export type ViewAdapterNoTaskError = {
    image: string
    imageSize?: string
    message: string
    isShowTaskCreateButton: boolean
}

export type ViewAdapterPropsBase = {
    getNoTaskError: () => ViewAdapterNoTaskError | undefined
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: TaskProjectViewObject['id'] | null) => string
    showTaskDetails?: (taskId: TaskViewObject['id']) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (field: string, order: string) => void
    clearSortOptions: () => void
}