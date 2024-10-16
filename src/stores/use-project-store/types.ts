import type { TodoColumnOptions, TodoFilter, TodoSortOptions } from '../use-todo-store'

export type Project = {
    id: string
    userId: string
    owner?: object
    title: string
    description: string
    state: 0 | 1 | 2
    isArchived: boolean
    isDeleted: boolean
    isFinished: boolean
    isFavorite: boolean
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    finishedAt: Date | null
    archivedAt: Date | null
    preference?: {
        viewType: 'table' | 'kanban'
        filterInfo: TodoFilter
        sortInfo: TodoSortOptions
        columns: TodoColumnOptions
    }
}

export type ProjectFilterOptionsRaw = Partial<Project>

export type ProjectPageOptions = { page?: number; limit?: number }

export type ProjectFilterOptions = ProjectFilterOptionsRaw & ProjectPageOptions

export type ProjectUpdateOptions = Partial<Omit<Project, 'id'>>

export type ProjectCreateOptions = { title: Project['title']; description?: Project['description'] }

export type CreateProjectPayload = ProjectCreateOptions

export type PageInfo = { page: number; limit: number; total: number }
