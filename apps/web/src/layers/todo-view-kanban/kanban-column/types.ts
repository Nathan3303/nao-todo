import type { Columns } from '@nao-todo/components'
import type { Todo, TodoState } from '@/stores'

export type KanbanColumnProps = {
    category: TodoState
    todos: Todo[]
    columns?: Columns
}

export type KanbanColumnEmits = {
    (event: 'show-todo-details', todoId: Todo['id']): void
    (event: 'delete-todo', todoId: Todo['id']): void
    (event: 'restore-todo', todoId: Todo['id']): void
    (event: 'finish-todo', todoId: Todo['id']): void
    (event: 'unfinish-todo', todoId: Todo['id']): void
    (event: 'heart-todo', todoId: Todo['id']): void
}
