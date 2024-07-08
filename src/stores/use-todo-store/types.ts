export type TodoStatus = 'todo' | 'in progress' | 'done'

export type TodoState = 'todo' | 'in-progress' | 'done'

export type TodoProgress = { total: number; finished: number }

export type TodoPriority = 0 | 1 | 2 | number | 'low' | 'medium' | 'high'

export type Todo = {
    _id?: string
    id: string
    projectId: string
    name: string
    description: string
    status: TodoStatus
    state: TodoState
    progress: TodoProgress
    priority: TodoPriority
    createdAt: string
    updatedAt: string
    tags: string[]
    dueDate: { startAt: string | null; endAt: string | null },
    justUpdated?: boolean
}

export type ShadowTodo = Partial<Todo>

export type TodoFilter = {
    name?: Todo['name'] | ''
    state?: string
    priority?: string
    tags?: Todo['tags'] | ''
}

export type TodoCountByState = {
    [key in TodoState]: number
}

export type TodoCountByPriority = {
    [key in TodoPriority]: number
}

export type TodoCountInfo = {
    count: number
    total: number
    byState: TodoCountByState
    byPriority: TodoCountByPriority
}
