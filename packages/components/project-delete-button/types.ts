export type ProjectDeleteButtonProps = {
    isDeleted?: boolean
}

export type ProjectDeleteButtonEmits = {
    (event: 'delete'): void
    (event: 'restore'): void
}
