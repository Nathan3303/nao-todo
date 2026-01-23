import type { Tag } from '@nao-todo/types'

export type TagManagerVO = {
    filterInfo: {
        name: string
    }
}

export type TagManagerProps = {
    tags: Tag[]
    tagCreatorOpener: () => void
    tagColorUpdaterOpener: (tagId: Tag['id']) => void
}

export type TagManagerEmits = {
    (e: 'register', open: () => void, close: () => void): void
    (e: 'deleteTag', tagId: Tag['id']): void
}
