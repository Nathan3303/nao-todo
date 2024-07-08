import type { Todo } from '@/stores'

export type TodoDetailsProps = {
    todo?: Todo
    loading?: boolean
}

export type TodoDetailsEmits = {
    (event: 'closeTodoDetails'): void
    (event: 'updateTodoName', name: Todo['name']): void
}
