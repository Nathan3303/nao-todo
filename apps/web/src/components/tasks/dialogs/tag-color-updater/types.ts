import type { GoAsync, TagViewObject, WithNull } from '@nao-todo/types'

export type TagColorUpdaterVO = {
    tagId: WithNull<TagViewObject['id']>
    color: TagViewObject['color']
    updating: boolean
    disabled: boolean
}

export type TagColorUpdaterProps = {
    tagColorGetter: (tagId: TagViewObject['id']) => TagViewObject['color'] | undefined
    tagColorUpdater: (tagId: TagViewObject['id'], color: TagViewObject['color']) => GoAsync<void>
}

export type TagColorUpdaterEmits = {
    (e: 'register', open: (tagId: TagViewObject['id']) => void, close: () => void): void
}
