import type { Event } from '@nao-todo/types'

export type TodoEventRowUpdatePayload = {
    id: Event['id']
    title: Event['title']
    isDone: Event['isDone']
}

export type TodoEventRowProps = {
    event: Event
    onUpdate: (payload: TodoEventRowUpdatePayload) => Promise<any>
    onDelete: (id: Event['id']) => Promise<any>
}

export type TodoEventRowEmits = {
    (event: 'update', payload: TodoEventRowUpdatePayload): void
    (event: 'delete', id: Event['id']): void
}
