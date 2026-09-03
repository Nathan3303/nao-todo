import type { NullableString } from '../../types'

export type ProjectFormVO = {
    icon: string
    name: string
    description?: NullableString
}

export type ProjectFormProps = {
    modelValue: ProjectFormVO
    disabled?: boolean
    isNameEmpty?: boolean
}

export type ProjectFormEmits = {
    (e: 'update:modelValue', value: ProjectFormVO): void
}