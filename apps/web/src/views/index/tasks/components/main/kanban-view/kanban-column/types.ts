import type { Todo, TodoColumnOptions } from '@nao-todo/types'

export type KanbanColumnProps = {
    category: Todo['state']
    todos: Todo[]
    columnOptions?: TodoColumnOptions
    disabled?: boolean
    loader?: () => Promise<void>
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
