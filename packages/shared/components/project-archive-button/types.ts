export type ProjectArchiveButtonProps = {
    isArchived?: boolean
}

export type ProjectArchiveButtonEmits = {
    (event: 'archive'): void
    (event: 'unarchive'): void
}