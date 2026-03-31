import type { ProjectViewObject } from '@nao-todo/types'

export type ProjectManagerVO = {
    filterInfo: {
        name?: string
        onlyDeleted?: boolean
    }
}

export type ProjectManagerProps = {
    projects: ProjectViewObject[]
    projectCreatorOpener: () => void
}

export type ProjectManagerEmits = {
    (e: 'register', open: () => void, close: () => void): void
    (e: 'deleteProject', projectId: ProjectViewObject['id']): void
    (e: 'restoreProject', projectId: ProjectViewObject['id']): void
    (e: 'hardDeleteProject', projectId: ProjectViewObject['id']): void
}
