export type EventInfo = {
    id: string
    name: string
    isDone: boolean
}

export type EventRowUpdatePayload = Partial<EventInfo>

export type EventRowProps = {
    event: EventInfo
    onUpdate: (id: string, payload: EventRowUpdatePayload) => Promise<any>
    onDelete: (id: string) => Promise<any>
}

export type EventRowEmits = {
    (event: 'toTask', id: string): void
}

