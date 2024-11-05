import type { Todo, TodoEvent } from '@nao-todo/stores'

export type TodoDetailsProps = {
    todo?: Todo
    loading?: boolean
}

export type TodoDetailsEmits = {
    (event: 'closeTodoDetails'): void
    (event: 'updateTodoName', name: Todo['name']): void
    (event: 'createTodoEvent', todoId: Todo['id'], newTodoEvent: Partial<TodoEvent>): void
    (event: 'updateTodoEvent', id: TodoEvent['id'], newTodoEvent: Partial<TodoEvent>): void
    (event: 'refresh'): void
}
