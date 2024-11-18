type FrameworkOption = {
    label: string
    value: string
    icon?: string
    disabled?: boolean
    suffix?: string | number
    checked?: boolean
}

type ComboBoxProps = {
    triggerTitle?: string
    triggerIcon?: string
    align?: 'left' | 'center' | 'right'
    framework: FrameworkOption[]
    hideCounter?: boolean
}

type ComboBoxEmits = {
    (event: 'change', value: unknown, payload: Partial<FrameworkOption>): void
}

export type { ComboBoxProps, ComboBoxEmits, FrameworkOption }
