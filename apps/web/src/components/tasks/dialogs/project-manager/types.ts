import type { ProjectVO } from '@nao-todo/types'

export type ProjectManagerVO = {
    filterInfo: {
        name?: string
        onlyDeleted?: boolean
    }
}

export type ProjectManagerProps = {
    projects: ProjectVO[]
}

export type ProjectManagerEmits = {
    (e: 'register', open: () => void, close: () => void): void
    (e: 'deleteProject', projectId: ProjectVO['id']): void
    (e: 'restoreProject', projectId: ProjectVO['id']): void
    (e: 'hardDeleteProject', projectId: ProjectVO['id']): void
}
