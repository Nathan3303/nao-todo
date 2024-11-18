import type { Todo } from '@nao-todo/types'
import type { Columns } from '@nao-todo/components'

export type TodoCardProps = {
    todo: Todo
    actived?: boolean
    columns?: Columns
}

export type TodoCardEmits = {
    // deleteTodo: (todo: Todo) => void
    (event: 'click', todoId: Todo['id']): void
    (event: 'delete', todoId: Todo['id']): void
    (event: 'restore', todoId: Todo['id']): void
    (event: 'finish', todoId: Todo['id']): void
    (event: 'unfinish', todoId: Todo['id']): void
    (event: 'heart', todoId: Todo['id']): void
}
