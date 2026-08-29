export type TaskCheckButtonProps = {
    isDone: boolean
    checked?: boolean
    size?: 'small' | 'large'
    isUpdating?: boolean
    /** 优先级颜色（NueUI 颜色变量或任意 CSS 颜色）；不传时使用默认色 */
    priorityColor?: string
}

export type TaskCheckButtonEmits = {
    (event: 'change', isDone: boolean): void
}