import type { TodoEvent } from '@/stores'

export type TodoEventRowUpdatePayload = {
    id: TodoEvent['id']
    title: TodoEvent['title']
    isDone: TodoEvent['isDone']
}

export type TodoEventRowProps = {
    event: TodoEvent
}

export type TodoEventRowEmits = {
    (event: 'update', payload: TodoEventRowUpdatePayload): void
    (event: 'delete', id: TodoEvent['id']): void
}
