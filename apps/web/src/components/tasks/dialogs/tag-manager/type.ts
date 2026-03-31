import type { TagViewObject } from '@nao-todo/types'

export type TagManagerVO = {
    filterInfo: {
        name: string
    }
}

export type TagManagerProps = {
    tags: TagViewObject[]
    tagCreatorOpener: () => void
    tagColorUpdaterOpener: (tagId: TagViewObject['id']) => void
}

export type TagManagerEmits = {
    (e: 'register', open: () => void, close: () => void): void
    (e: 'deleteTag', tagId: TagViewObject['id']): void
}
