import type { Tag, Todo } from '@nao-todo/types'

type TagBarProps = {
    tags: Tag[]
    todoTags: Todo['tags']
    clamped?: number
    readonly?: boolean
    small?: boolean
}

type TagBarEmits = {
    (event: 'updateTags', tags: Todo['tags']): void
}

export type { TagBarProps, TagBarEmits }
