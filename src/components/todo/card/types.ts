import type { Todo } from '@/stores'

export type TodoCardProps = {
    todo: Todo
    actived?: boolean
}

export type TodoCardEmits = {
    // deleteTodo: (todo: Todo) => void
    (event: 'click', todoId: Todo['id']): void
    (event: 'delete', todoId: Todo['id']): void
    (event: 'finish', todoId: Todo['id']): void
    (event: 'unfinish', todoId: Todo['id']): void
    (event: 'heart', todoId: Todo['id']): void
}
