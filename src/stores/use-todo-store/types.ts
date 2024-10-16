import type { Project } from '../use-project-store'
import type { Tag } from '../use-tag-store'

export type TodoStatus = 'todo' | 'in progress' | 'done'
export type TodoState = 'todo' | 'in-progress' | 'done'
export type TodoProgress = { total: number; finished: number }
export type TodoPriority = 'low' | 'medium' | 'high'
export type TodoEvent = { id: string; isDone: boolean; isTopped: boolean; title: string }
export type Todo = {
    _id?: string
    id: string
    userId: string
    projectId: string
    name: string
    description: string
    status: TodoStatus
    state: TodoState
    progress: TodoProgress
    priority: TodoPriority
    createdAt: string
    updatedAt: string
    dueDate: { startAt: string | null; endAt: string | null }
    justUpdated?: boolean
    events: TodoEvent[]
    isPinned: boolean
    isDone: boolean
    isDeleted: boolean
    project?: Partial<Project>
    tags: Tag['id'][]
    tagsInfo: Tag[]
    isNew?: boolean
}

export type TodoFilter = {
    id?: string
    projectId?: string
    userId?: string
    name?: string
    state?: string
    isPinned?: boolean
    isDone?: boolean
    isDeleted?: boolean
    priority?: string
    relativeDate?: 'today' | 'tomorrow' | 'week'
    tagId?: Tag['id']
}

export type TodoColumnOptions = {
    createdAt: boolean
    priority: boolean
    state: boolean
    description: boolean
    updatedAt: boolean
    startAt?: boolean
    endAt?: boolean
    project?: boolean
}

export type ShadowTodo = Partial<Todo>
export type TodoSortOptions = { field: keyof Todo | 'endAt' | ''; order: 'asc' | 'desc' | '' }
export type TodoCountByState = { [key in TodoState]: number }
export type TodoCountByPriority = { [key in TodoPriority]: number }
export type TodoCountInfo = {
    length: number
    count: number
    total: number
    byState: TodoCountByState
    byPriority: TodoCountByPriority
}
