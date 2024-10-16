export type FrameworkOption = {
    label: string
    value: string
    icon?: string
    disabled?: boolean
    suffix?: string | number
    checked?: boolean
}

export type ComboBoxProps = {
    triggerTitle?: string
    triggerIcon?: string
    align?: 'left' | 'center' | 'right'
    framework: FrameworkOption[]
    hideCounter?: boolean
}
