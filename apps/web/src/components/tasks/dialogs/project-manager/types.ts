import type { Project } from '@nao-todo/types'

export type ProjectManagerVO = {
    filterInfo: {
        name?: string
        onlyDeleted?: boolean
    }
}

export type ProjectManagerProps = {
    projects: Project[]
    projectCreatorOpener: () => void
}

export type ProjectManagerEmits = {
    (e: 'register', open: () => void, close: () => void): void
    (e: 'deleteProject', projectId: Project['id']): void
    (e: 'restoreProject', projectId: Project['id']): void
    (e: 'hardDeleteProject', projectId: Project['id']): void
}
