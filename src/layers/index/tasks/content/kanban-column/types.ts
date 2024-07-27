import type { Todo } from '@/stores'

export type KanbanColumnProps = {
    category: string
    todos: Todo[]
}

export type KanbanColumnEmits = {
    (event: 'show-todo-details', todoId: Todo['id']): void
    (event: 'delete-todo', todoId: Todo['id']): void
    (event: 'restore-todo', todoId: Todo['id']): void
    (event: 'finish-todo', todoId: Todo['id']): void
    (event: 'unfinish-todo', todoId: Todo['id']): void
    (event: 'heart-todo', todoId: Todo['id']): void
}
