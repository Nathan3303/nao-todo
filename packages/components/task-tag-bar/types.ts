import { Tag, Task } from '@nao-todo/types'

export type TaskTagBarProps = {
    tags: Tag[]
    taskTags: Task['tags']
    clamped?: number
    readonly?: boolean
    small?: boolean
    transformOrigin?: string
}
export type TaskTagBarEmits = {
    (event: 'updateTags', tags: Task['tags']): void
}
