import type { GetTodosOptions, GoLike, Tag, Todo, TodoColumnOptions } from '@nao-todo/types'
import type { ComputedRef } from 'vue'

export type TodoKanbanProps = {
    columnOptions: TodoColumnOptions
}

export type TodoKanbanEmits = {
    (event: 'show-todo-details', todoId: Todo['id']): void
    (event: 'delete-todo', todoId: Todo['id']): void
    (event: 'restore-todo', todoId: Todo['id']): void
    (event: 'finish-todo', todoId: Todo['id']): void
    (event: 'unfinish-todo', todoId: Todo['id']): void
}

export type TodoKanbanContext = {
    todos: ComputedRef<Todo[]>
    tags: ComputedRef<Tag[]>
    getProjectName: (projectId: Todo['projectId']) => string
    getTodosWithPush: (options: GetTodosOptions) => Promise<GoLike<number | null>>
}

export type TodoKanbanColumnProps = {
    todos: Todo[]
    category: string
    columnOptions?: TodoColumnOptions
    disabled?: boolean
}

export type TodoKanbanColumnEmits = TodoKanbanEmits & {
    (event: 'heart-todo', todoId: Todo['id']): void
    (event: 'load-more'): void
    (event: 'filter-todos-by-category', category: string): void
}

export type TodoKanbanColumnItemProps = {
    todo: Todo
    tags: Tag[]
    actived?: boolean
    columns?: TodoColumnOptions
}

export type TodoKanbanColumnItemEmits = {
    (event: 'click', todoId: Todo['id']): void
    (event: 'delete', todoId: Todo['id']): void
    (event: 'restore', todoId: Todo['id']): void
    (event: 'finish', todoId: Todo['id']): void
    (event: 'unfinish', todoId: Todo['id']): void
    (event: 'heart', todoId: Todo['id']): void
}
