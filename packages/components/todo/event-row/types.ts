import type { TodoEvent } from '@nao-todo/stores'

export type TodoEventRowUpdatePayload = {
    id: TodoEvent['id']
    title: TodoEvent['title']
    isDone: TodoEvent['isDone']
}

export type TodoEventRowProps = {
    event: TodoEvent
    onUpdate: (payload: TodoEventRowUpdatePayload) => Promise<any>
    onDelete: (id: TodoEvent['id']) => Promise<any>
}

export type TodoEventRowEmits = {
    (event: 'update', payload: TodoEventRowUpdatePayload): void
    (event: 'delete', id: TodoEvent['id']): void
}
