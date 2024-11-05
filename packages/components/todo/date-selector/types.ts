export type TodoDateSelectorProps = {
    modelValue?: string | null
    date?: Date | string | null
}

export type TodoDateSelectorEmits = {
    (event: 'update:modelValue', value: string | null): void
    (event: 'change', value: string | null): void
}
