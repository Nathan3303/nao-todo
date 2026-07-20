export type CheckboxProps = {
    checked?: boolean
    label: string
    value: unknown
    icon?: string
    count?: string | number
}

export type CheckboxEmits = {
    (event: 'check', checked: boolean, value: unknown): void
}
