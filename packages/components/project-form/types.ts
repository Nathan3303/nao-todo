export type ProjectFormVO = {
    name: string
    description: string
}

export type ProjectFormProps = {
    modelValue: ProjectFormVO
    disabled?: boolean
    isNameEmpty?: boolean
}

export type ProjectFormEmits = {
    (e: 'update:modelValue', value: ProjectFormVO): void
}
