export type TagColorSelectorProps = {
    disabled?: boolean
    modelValue?: string
}

export type TagColorSelectorEmits = {
    (event: 'update:modelValue', color: string): void
}
