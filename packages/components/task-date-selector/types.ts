export type TaskDateSelectorProps = {
    colored?: boolean
    modelValue?: string | null
    date?: Date | string | null
}

export type TaskDateSelectorEmits = {
    (event: 'update:modelValue', value: string | null): void
    (event: 'change', value: string | null): void
}

