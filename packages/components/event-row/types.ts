export type EventInfo = {
    id: string
    name: string
    isDone: boolean
}

export type EventRowUpdatePayload = EventInfo

export type EventRowProps = {
    event: EventInfo
    onUpdate: (payload: EventRowUpdatePayload) => Promise<any>
    onDelete: (id: string) => Promise<any>
}

export type EventRowEmits = {
    (event: 'update', payload: EventRowUpdatePayload): void
    (event: 'delete', id: string): void
}
