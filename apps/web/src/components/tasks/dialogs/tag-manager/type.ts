import type { TagViewObject } from '@nao-todo/types'

export type TagManagerProps = {
    tags: TagViewObject[]
    tagCreatorOpener: () => void
    tagColorUpdaterOpener: (tagId: TagViewObject['id']) => void
}

export type TagManagerEmits = {
    (e: 'register', open: () => void, close: () => void): void
}
