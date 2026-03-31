import { TagViewObject, TaskViewObject } from '@nao-todo/types'

export type TaskTagBarProps = {
    tags: TagViewObject[]
    taskTags: TaskViewObject['tags']
    clamped?: number
    readonly?: boolean
    small?: boolean
    transformOrigin?: string
}
export type TaskTagBarEmits = {
    (event: 'updateTags', tags: TaskViewObject['tags']): void
}
