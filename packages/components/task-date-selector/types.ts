export type TaskDateSelectorProps = {
    colored?: boolean
    modelValue: string | null | undefined
}

export type TaskDateSelectorEmits = {
    (e: 'update:modelValue', value: string | null): void
    (e: 'change', value: string | null): void
}
