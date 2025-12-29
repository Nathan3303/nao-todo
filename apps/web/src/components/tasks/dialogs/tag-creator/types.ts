import type { GoAsync, CreateTagVO } from '@nao-todo/types'

export type TagCreatorVO = {
    name: string
    description: string
    color: string
    isNameEmpty: boolean
    creating: boolean
}

export type TagCreatorProps = {
    creatrTagHandler: (createVO: CreateTagVO) => GoAsync<string>
}

export type TagCreatorEmits = {
    (e: 'register', open: () => void, close: () => void): void
}