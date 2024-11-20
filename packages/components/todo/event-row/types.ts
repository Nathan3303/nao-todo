type TodoEventInfo = {
    id: string
    title: string
    isDone: boolean
}

type TodoEventRowUpdatePayload = TodoEventInfo

type TodoEventRowProps = {
    event: TodoEventInfo
    onUpdate: (payload: TodoEventRowUpdatePayload) => Promise<any>
    onDelete: (id: string) => Promise<any>
}

type TodoEventRowEmits = {
    (event: 'update', payload: TodoEventRowUpdatePayload): void
    (event: 'delete', id: string): void
}

export type { TodoEventRowProps, TodoEventRowEmits, TodoEventRowUpdatePayload }
