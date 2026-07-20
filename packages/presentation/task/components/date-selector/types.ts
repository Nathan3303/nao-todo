import type { TaskViewObject, UpdateTaskViewObject } from '../../types'
import type { TaskRemindSetterUpdateVO } from '../remind-setter/types'

export type TaskDateSelectorProps = {
    colored?: boolean
    modelValue: string | null
    task?: TaskViewObject
}

export type TaskDateSelectorEmits = {
    (e: 'update:modelValue', value: string | null): void
    (e: 'change', value: string | null): void
    (e: 'remind-change', vo: TaskRemindSetterUpdateVO): void
    (e: 'update-all', vo: UpdateTaskViewObject): void
}
