import type { TagCardVO } from '../tag-card/types'

export type TagBoardProps = {
    loadingState?: boolean
    tags: TagCardVO[]
}
export type TagBoardEmits = {
    (event: 'delete', tagId: TagCardVO['id']): void
    (event: 'recolor', tagId: TagCardVO['id']): void
}
export type TagBoardSlots = {
    ops: { tag: TagCardVO }
}