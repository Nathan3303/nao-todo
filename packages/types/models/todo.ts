import type { GetRequestPageOptions } from '../axios/common'
import type { User } from './user'
import type { Project } from './project'
import type { Tag } from './tag'
import type { Moment } from 'moment'

type TodoDueDate = {
    startAt: Moment | string | null
    endAt: Moment | string | null
}

interface Todo {
    id: string
    userId: User['id']
    projectId: Project['id']
    name: string
    description: string
    state: 'todo' | 'in-progress' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    tags: Tag['id'][]
    dueDate: TodoDueDate
    isDeleted: boolean
    isArchived: boolean
    isFavorited: boolean
    createdAt: Date
    updatedAt: Date
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
    name?: Todo['name']
    description?: Todo['description']
    state?: string
    priority?: string
    isArchived?: Todo['isArchived']
    isDeleted?: Todo['isDeleted']
    isFavorited?: Todo['isFavorited']
    sort?: GetTodosSortOptions
    relativeDate?: 'today' | 'tomorrow' | 'week'
}

type UpdateTodoOptionsRaw = {
    projectId?: Project['id']
    name?: Todo['name']
    description?: Todo['description']
    state?: Todo['state']
    priority?: Todo['priority']
    tags?: Todo['tags']
    dueDate?: TodoDueDate
    isDeleted?: Todo['isDeleted']
    isArchived?: Todo['isArchived']
    isFavorited?: Todo['isFavorited']
}

type CreateTodoOptions = UpdateTodoOptions

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

type TodoColumnOptions = Partial<{
    name: boolean
    description: boolean
    state: boolean
    priority: boolean
    tags: boolean
    endAt: boolean
    createdAt: boolean
    updatedAt: boolean
    project: boolean
}>

export type {
    Todo,
    TodoDueDate,
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
