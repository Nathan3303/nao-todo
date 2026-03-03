export type TaskCheckButtonProps = {
    isDone: boolean
    checked?: boolean
    size?: 'small' | 'large'
}

export type TaskCheckButtonEmits = {
    (event: 'change', isDone: boolean): void
}
