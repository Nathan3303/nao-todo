export type SwitchButtonProps = {
    modelValue: boolean
    icon?: string
    activeIcon?: string
    text?: string
    activeText?: string
    theme?: string | string[]
}

export type SwitchButtonEmits = {
    (event: 'update:modelValue', value: boolean): void
    (event: 'change', value: boolean): void
}
