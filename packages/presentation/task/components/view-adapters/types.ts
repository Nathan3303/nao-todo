import type { TaskColumnOptions, TaskViewObject } from '@nao-todo/domain-task/viewobjects'
import type { TaskProjectViewObject } from '@nao-todo/domain-task/viewobjects'

export type ViewAdapterNoTaskError = {
    image: string
    imageSize?: string
    message: string
    isShowTaskCreateButton: boolean
}

export type ViewAdapterPropsBase = {
    getNoTaskError: () => ViewAdapterNoTaskError | undefined
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: TaskProjectViewObject['id']) => string
    showTaskDetails?: (taskId: TaskViewObject['id']) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (field: string, order: string) => void
    clearSortOptions: () => void
}
