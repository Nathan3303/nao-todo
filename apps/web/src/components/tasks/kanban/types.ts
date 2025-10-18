import type { Tag, Todo, TodoColumnOptions } from '@nao-todo/types'

export type TodoKanbanProps = {
    columnOptions: TodoColumnOptions
}

export type KanbanColumnProps = {
    todos: Todo[]
    category: string
    columnOptions?: TodoColumnOptions
    disabled?: boolean
}

export type KanbanColumnEmits = {
    (event: 'show-todo-details', todoId: Todo['id']): void
    (event: 'delete-todo', todoId: Todo['id']): void
    (event: 'restore-todo', todoId: Todo['id']): void
    (event: 'finish-todo', todoId: Todo['id']): void
    (event: 'unfinish-todo', todoId: Todo['id']): void
    (event: 'heart-todo', todoId: Todo['id']): void
    (event: 'load-more'): void
}

export type KanbanColumnItemProps = {
    todo: Todo
    tags: Tag[]
    actived?: boolean
    columns?: TodoColumnOptions
}

export type KanbanColumnItemEmits = {
    (event: 'click', todoId: Todo['id']): void
    (event: 'delete', todoId: Todo['id']): void
    (event: 'restore', todoId: Todo['id']): void
    (event: 'finish', todoId: Todo['id']): void
    (event: 'unfinish', todoId: Todo['id']): void
    (event: 'heart', todoId: Todo['id']): void
}
