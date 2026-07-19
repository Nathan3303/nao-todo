import type { CreateProjectViewObject } from '@nao-todo/domain/project'

export type ProjectFormProps = {
    modelValue: CreateProjectViewObject
    disabled?: boolean
    isNameEmpty?: boolean
}

export type ProjectFormEmits = {
    (e: 'update:modelValue', value: CreateProjectViewObject): void
}

