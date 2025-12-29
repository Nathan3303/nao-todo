import type { GoAsync } from "@nao-todo/types"

export type ProjectCreatorVO = {
    name: string
    description: string
}

export type ProjectCreatorProps = {
    creator: (vo: ProjectCreatorVO) => GoAsync<string>
}

export type ProjectCreatorEmits = {
    (e: 'register', open: () => void, close: () => void): void
}
