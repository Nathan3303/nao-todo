type Option = {
    label: string
    value: unknown
    disabled?: boolean
}

export type TodoSelectorProps = {
    value: unknown
    options?: Option[]
}

export type TodoSelectorEmits = {
    (event: 'change', value: unknown): void
}
