import type { GoAsync, ProjectViewObject } from '@nao-todo/types'

export type ProjectUpdaterVO = {
    projectId: string | null
    name: string
    description: string
    updating: boolean
    disabled: boolean
}

export type ProjectUpdaterProps = {
    projectGetter: (projectId: ProjectViewObject['id']) => ProjectViewObject | undefined
    updater: (
        projectId: ProjectViewObject['id'],
        vo: { name: string; description: string }
    ) => GoAsync<void>
}

export type ProjectUpdaterEmits = {
    (e: 'register', open: (projectId: string) => void, close: () => void): void
}
