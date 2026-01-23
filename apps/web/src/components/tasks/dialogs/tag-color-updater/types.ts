import type { GoAsync, Tag, WithNull } from '@nao-todo/types'

export type TagColorUpdaterVO = {
    tagId: WithNull<Tag['id']>
    color: Tag['color']
    updating: boolean
    disabled: boolean
}

export type TagColorUpdaterProps = {
    tagColorGetter: (tagId: Tag['id']) => Tag['color'] | undefined
    tagColorUpdater: (tagId: Tag['id'], color: Tag['color']) => GoAsync<void>
}

export type TagColorUpdaterEmits = {
    (e: 'register', open: (tagId: Tag['id']) => void, close: () => void): void
}
