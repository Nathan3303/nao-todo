export type TaskCheckButtonProps = {
    isDone: boolean
    checked?: boolean
    size?: 'small' | 'large'
    isUpdating?: boolean
}

export type TaskCheckButtonEmits = {
    (event: 'change', isDone: boolean): void
}