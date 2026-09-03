import { NueButtonSize } from 'nue-ui'

export type TaskDeleteButtonProps = {
    isDeleted?: boolean
    size?: NueButtonSize
}

export type TaskDeleteButtonEmits = {
    (event: 'delete'): void
    (event: 'restore'): void
}