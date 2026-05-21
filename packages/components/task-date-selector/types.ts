import type { TaskRemindSetterUpdateVO, TaskRemindData } from '../task-remind-setter/types'

export type TaskDateSelectorProps = {
    colored?: boolean
    modelValue: string | null | undefined
    task?: TaskRemindData
}

export type TaskDateSelectorEmits = {
    (e: 'update:modelValue', value: string | null): void
    (e: 'change', value: string | null): void
    (e: 'remind-change', vo: TaskRemindSetterUpdateVO): void
}
