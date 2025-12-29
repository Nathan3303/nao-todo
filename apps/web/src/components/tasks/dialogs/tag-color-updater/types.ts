import type { GoAsync, TagVO, WithNull } from '@nao-todo/types'

export type TagColorUpdaterVO = {
    tagId: WithNull<TagVO['id']>
    color: TagVO['color']
    updating: boolean
    disabled: boolean
}

export type TagColorUpdaterProps = {
    tagColorGetter: (tagId: TagVO['id']) => TagVO['color'] | undefined
    tagColorUpdater: (tagId: TagVO['id'], color: TagVO['color']) => GoAsync<void>
}

export type TagColorUpdaterEmits = {
    (e: 'register', open: (tagId: TagVO['id']) => void, close: () => void): void
}
