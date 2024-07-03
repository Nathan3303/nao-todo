export type FrameworkOption = {
    label: string
    value: string
    icon?: string
    disabled?: boolean
    suffix?: string | number
    checked?: boolean
}

export type ComboBoxProps = {
    framework: FrameworkOption[]
}
