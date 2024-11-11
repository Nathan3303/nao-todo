import type { GetRequestPageOptions } from './common'
import type { User } from './user'
import type { Project } from './project'
import type { Tag } from './tag'

type TodoDueDate = {
    startAt: Date | string | null
    endAt: Date | string | null
}

interface Todo {
    id: string
    userId: User['id']
    projectId: Project['id']
    name: string
    description: string
    state: 'todo' | 'doing' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    tags: Tag['id'][]
    dueDate: TodoDueDate
    isDeleted: boolean
    isArchived: boolean
    isFavorite: boolean
    createdAt: Date
    updatedAt: Date
}

type GetTodoOptionsRaw = {
    id?: Todo['id']
    name?: Todo['name']
    description?: Todo['description']
}

type GetTodosOptionsRaw = {
    name?: Todo['name']
    description?: Todo['description']
    isArchived?: Todo['isArchived']
    isDeleted?: Todo['isDeleted']
    sort?: {
        field: keyof Todo
        order: 'asc' | 'desc'
    }
}

type UpdateTodoOptionsRaw = {
    projectId: Project['id']
    name?: Todo['name']
    description?: Todo['description']
    state?: Todo['state']
    priority?: Todo['priority']
    tags?: Todo['tags']
    dueDate?: TodoDueDate
    isDeleted?: Todo['isDeleted']
    isArchived?: Todo['isArchived']
    isFavorite?: Todo['isFavorite']
}

type CreateTodoOptions = UpdateTodoOptions

type DeleteTodoOptions = GetTodoOptions

type UpdateTodoOptions = UpdateTodoOptionsRaw

type GetTodoOptions = GetTodoOptionsRaw

type GetTodosOptions = GetTodosOptionsRaw & GetRequestPageOptions

export type {
    Todo,
    TodoDueDate,
    CreateTodoOptions,
    DeleteTodoOptions,
    UpdateTodoOptions,
    GetTodoOptions,
    GetTodosOptions
}
