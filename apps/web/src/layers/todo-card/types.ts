import type { Todo, TodoColumnOptions } from '@nao-todo/types'

export type TodoCardProps = {
    todo: Todo
    actived?: boolean
    columns?: TodoColumnOptions
}

export type TodoCardEmits = {
    (event: 'click', todoId: Todo['id']): void
    (event: 'delete', todoId: Todo['id']): void
    (event: 'restore', todoId: Todo['id']): void
    (event: 'finish', todoId: Todo['id']): void
    (event: 'unfinish', todoId: Todo['id']): void
    (event: 'heart', todoId: Todo['id']): void
}
