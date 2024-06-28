export type TodoStatus = 'todo' | 'in progress' | 'done'

export type TodoState = 'todo' | 'in-progress' | 'done'

export type TodoProgress = { total: number; finished: number }

export type TodoPriority = 0 | 1 | 2 | number

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
}

export type ShadowTodo = Partial<Todo>

export type TodoFilter = {
    name?: Todo['name'] | ''
    state?: Todo['state'] | ''
    priority?: Todo['priority'] | ''
    tags?: Todo['tags'] | ''
}
