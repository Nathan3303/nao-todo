export type EventInfo = {
    id: string
    name: string
    isDone: boolean
}

export type EventRowUpdatePayload = Partial<EventInfo>

export type EventRowProps = {
    event: EventInfo
    onUpdate: (id: string, payload: EventRowUpdatePayload) => Promise<void>
    onDelete: (id: string) => Promise<void>
}

export type EventRowEmits = {
    (event: 'toTask', id: string): void
}