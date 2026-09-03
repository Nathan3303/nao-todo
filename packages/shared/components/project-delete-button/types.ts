export type ProjectDeleteButtonProps = {
    isDeleted?: boolean
    loading?: boolean
}

export type ProjectDeleteButtonEmits = {
    (event: 'delete'): void
    (event: 'restore'): void
}