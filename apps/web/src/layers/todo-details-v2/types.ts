import type { Todo, Event } from '@nao-todo/types'

export type TodoDetailsProps = {
    loading?: boolean
}

export type TodoDetailsEmits = {
    (event: 'closeTodoDetails'): void
    (event: 'updateTodoName', name: Todo['name']): void
    (event: 'createTodoEvent', todoId: Todo['id'], newTodoEvent: Partial<Event>): void
    (event: 'updateTodoEvent', id: Event['id'], newTodoEvent: Partial<Event>): void
    (event: 'refresh'): void
}
