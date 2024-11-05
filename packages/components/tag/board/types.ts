import type { Tag } from '@nao-todo/stores'

export type TagBoardProps = {
    loadingState?: boolean
    tags: Tag[]
}

export type TagBoardEmits = {
    (event: 'delete', tagId: Tag['id']): void
    (event: 'recolor', tagId: Tag['id']): void
}
