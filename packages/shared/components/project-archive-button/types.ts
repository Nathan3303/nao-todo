export type ProjectArchiveButtonProps = {
    isArchived?: boolean
    loading?: boolean
}

export type ProjectArchiveButtonEmits = {
    (event: 'archive'): void
    (event: 'unarchive'): void
}