import type { Tag, Todo } from "@/stores"

export type TodoTagBarProps = {
    tags: Tag[]
    todoTags: Todo['tags']
    clamped?: number
    readonly?: boolean
    small?: boolean
}

export type TodoTagBarEmits = {
    (event: 'updateTags', tags: Todo['tags']): void
}
