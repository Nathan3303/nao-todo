import { TagViewObject } from '@nao-todo/types'

export type TagBoardProps = {
    loadingState?: boolean
    tags: TagViewObject[]
}
export type TagBoardEmits = {
    (event: 'delete', tagId: TagViewObject['id']): void
    (event: 'recolor', tagId: TagViewObject['id']): void
}
export type TagBoardSlots = {
    ops: { tag: TagViewObject }
}

