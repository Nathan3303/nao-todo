import type { GoAsync, TagViewObject } from '@nao-todo/types'

export type TagUpdaterVO = {
    tagId: string | null
    name: string
    description: string
    color: string
    updating: boolean
    disabled: boolean
}

export type TagUpdaterProps = {
    tagGetter: (tagId: TagViewObject['id']) => TagViewObject | undefined
    updater: (
        tagId: TagViewObject['id'],
        vo: { name: string; description: string; color: string }
    ) => GoAsync<void>
}

export type TagUpdaterEmits = {
    (e: 'register', open: (tagId: string) => void, close: () => void): void
}
