export type ComboBoxOption = {
    label: string
    value: string
    icon?: string
    disabled?: boolean
    suffix?: string | number
    checked?: boolean
}

export type FrameworkOption = ComboBoxOption

export type ComboBoxProps = {
    triggerTitle?: string
    triggerIcon?: string
    align?: 'left' | 'center' | 'right'
    framework: ComboBoxOption[]
    hideCounter?: boolean
}

export type ComboBoxEmits = {
    (event: 'change', value: unknown, payload: Partial<ComboBoxOption>): void
}