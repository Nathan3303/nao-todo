export type CreateTagDialogProps = {
    handler: Function
}

export type CreateTagPayload = {
    name: string
    color: string
}

export type CreateTagDialogEmits = {
    (event: 'create', payload: CreateTagPayload): void
}
