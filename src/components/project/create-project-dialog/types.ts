export type NewProjectPayload = {
    name: string
    description?: string
}

export type CreateProjectDialogProps = {}

export type CreateProjectDialogEmits = {
    (event: 'create', payload: NewProjectPayload): void
}
