import type { CreatePomodoroViewObject } from '@nao-todo/domain-pomodoro'

// 番茄专注表单状态
export type PomodoroFormState = {
    type: CreatePomodoroViewObject['type']
    name: string
    description: string
    duration: number
}

// 番茄专注表单属性
export type PomodoroFormProps = {
    modelValue: PomodoroFormState
    disabled?: boolean
    isNameEmpty?: boolean
}

// 番茄专注表单事件
export type PomodoroFormEmits = {
    (e: 'update:modelValue', value: PomodoroFormState): void
}
