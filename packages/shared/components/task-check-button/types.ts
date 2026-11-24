export type TaskCheckButtonProps = {
    isDone: boolean
    checked?: boolean
    size?: 'small' | 'large'
    isUpdating?: boolean
    /** 优先级颜色（NueUI 颜色变量或任意 CSS 颜色）；不传时使用默认色 */
    priorityColor?: string
    /**
     * 只读（`T795`）：已归档任务等只读场景禁用勾选（原生 `disabled` ⇒ 不可点、键盘不可达）
     * @default false
     */
    disabled?: boolean
}

export type TaskCheckButtonEmits = {
    (event: 'change', isDone: boolean): void
}