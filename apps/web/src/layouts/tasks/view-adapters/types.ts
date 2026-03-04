import type { Project, TaskColumnOptions } from '@nao-todo/types'

export type ViewAdapterPropsBase = {
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: Project['id']) => string
    showTaskDetails: () => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (field: string, order: string) => void
    clearSortOptions: () => void
}
