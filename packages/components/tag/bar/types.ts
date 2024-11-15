import type { Tag } from '@nao-todo/types'

export type TagBarProps = {
    tags: Tag[]
    readonly?: boolean
}

export type TagBarEmits = {
    (event: 'delete-tag', tagId: Tag['id']): void
}
