import type { GetRequestPageOptions } from '../axios/common'
import type { User } from './user'
import type { Project } from './project'
import type { Event } from './event'
import type { Tag } from './tag'

type Todo = {
    id: string
    userId: User['id']
    projectId: Project['id']
    name: string
    description: string
    state: 'todo' | 'in-progress' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    tags: Tag['id'][]
    startAt?: string | null
    endAt?: string | null
    isDeleted: boolean
    deletedAt: string | null
    isArchived: boolean
    archivedAt: string | null
    isFavorited: boolean
    isGivenUp: boolean
    createdAt: string
    updatedAt: string
    // Additional fields
    project?: { name: Project['name'] }
    events?: Event[]
}

type TodoColumnOptions = {
    // id: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    // userId?: boolean
    // projectId?: boolean
    project?: boolean
    // name?: boolean
    description?: boolean
    state?: boolean
    priority?: boolean
    tags?: boolean
    startAt?: boolean
    endAt?: boolean
    isDeleted?: boolean
    isArchived?: boolean
    archivedAt?: boolean
    isFavorited?: boolean
    isGivenUp?: boolean
}

type GetTodoOptionsRaw = {
    id?: Todo['id']
    name?: Todo['name']
    description?: Todo['description']
}

type GetTodosSortOptions = {
    field: keyof Todo
    order: 'asc' | 'desc'
}

type GetTodosOptionsRaw = {
    projectId?: Todo['projectId']
    name?: Todo['name'] | null
    description?: Todo['description']
    state?: string
    priority?: string
    isArchived?: Todo['isArchived']
    isDeleted?: Todo['isDeleted']
    isFavorited?: Todo['isFavorited']
    isGivenUp?: Todo['isGivenUp']
    sort: GetTodosSortOptions
    relativeDate?: 'today' | 'tomorrow' | 'week' | '-today' | 'month'
    tagId?: Tag['id']
}

type UpdateTodoOptionsRaw = {
    projectId?: Project['id']
    name?: Todo['name']
    description?: Todo['description']
    state?: Todo['state']
    priority?: Todo['priority']
    tags?: Todo['tags']
    startAt?: string | null
    endAt?: string | null
    isDeleted?: Todo['isDeleted']
    deletedAt?: Todo['deletedAt']
    isArchived?: Todo['isArchived']
    archivedAt?: Todo['archivedAt']
    isFavorited?: Todo['isFavorited']
    isGivenUp?: Todo['isFavorited']
}

type CreateTodoOptionsRaw = {
    projectId?: Project['id']
    name?: Todo['name']
    description?: Todo['description']
    state?: Todo['state']
    priority?: Todo['priority']
    tags?: Todo['tags']
    startAt?: string | null
    endAt?: string | null
    isDeleted?: Todo['isDeleted']
    deletedAt?: Todo['deletedAt']
    isArchived?: Todo['isArchived']
    archivedAt?: Todo['archivedAt']
    isFavorited?: Todo['isFavorited']
    isGivenUp?: Todo['isFavorited']
}

type CreateTodoOptions = CreateTodoOptionsRaw

type DeleteTodoOptions = GetTodoOptions

type UpdateTodoOptions = UpdateTodoOptionsRaw

type GetTodoOptions = GetTodoOptionsRaw

type GetTodosOptions = GetTodosOptionsRaw & GetRequestPageOptions

type GetTodosResponseData = { todos: Todo[]; payload: GetTodosOverview }

type GetTodosOverview = {
    countInfo: {
        byPriority: Record<string, number>
        byState: Record<string, number>
        count: number
        length: number
        total: number
    }
    pageInfo: { page: number; totalPages: number }
}

export type {
    Todo,
    CreateTodoOptions,
    DeleteTodoOptions,
    UpdateTodoOptionsRaw,
    UpdateTodoOptions,
    GetTodoOptions,
    GetTodosSortOptions,
    GetTodosOptions,
    GetTodosResponseData,
    GetTodosOverview,
    TodoColumnOptions
}
