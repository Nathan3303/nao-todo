export type TagFormVO = {
    name: string
    description: string
}

export type TagFormProps = {
    modelValue: TagFormVO
    disabled?: boolean
    isNameEmpty?: boolean
}

export type TagFormEmits = {
    (e: 'update:modelValue', value: TagFormVO): void
}
