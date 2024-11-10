export interface Todo {
    id: string
    userId: string
    projectId: string
    name: string
    description: string
    state: 'todo' | 'doing' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    tags: string[]
    dueDate: { startAt: Date | string | null; endAt: Date | string | null }
    isDeleted: boolean
    isArchived: boolean
    isFavorite: boolean
    createdAt: Date
    updatedAt: Date
}

export interface FetchTodosOptions {
    projectId?: string
    name?: string
    state?: Todo['state'][]
    priority?: Todo['priority'][]
    tagId?: string
    dueDate?: Todo['dueDate']
    isDeleted?: boolean
    isArchived?: boolean
    isFavorite?: boolean
    relativeDate?: string
    page: number
    limit: number
    sort: { field: string; order: 'asc' | 'desc' }
}

export type ResponseData = {
    code: number
    message: string
    data: unknown
}
