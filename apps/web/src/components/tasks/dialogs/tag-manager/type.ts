import type { TagVO } from "@nao-todo/types"

export type TagManagerVO = {
    filterInfo: {
        name: string
    }
}

export type TagManagerProps = {
    tags: TagVO[]
}

export type TagManagerEmits = {
    (e: 'register', open: () => void, close: () => void): void
    (e: 'deleteTag', tagId: TagVO['id']): void
}
