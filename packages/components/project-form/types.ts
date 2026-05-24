import type { CreateProjectViewObject } from '@nao-todo/types'

export type ProjectFormProps = {
    modelValue: CreateProjectViewObject
    disabled?: boolean
    isNameEmpty?: boolean
}

export type ProjectFormEmits = {
    (e: 'update:modelValue', value: CreateProjectViewObject): void
}

