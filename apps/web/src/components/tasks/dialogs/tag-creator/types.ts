import type { GoAsync, CreateTag } from '@nao-todo/types'

export type TagCreatorVO = {
    name: string
    description: string
    color: string
    isNameEmpty: boolean
    creating: boolean
}

export type TagCreatorProps = {
    creatrTagHandler: (createVO: CreateTag) => GoAsync<string>
}

export type TagCreatorEmits = {
    (e: 'register', open: () => void, close: () => void): void
}