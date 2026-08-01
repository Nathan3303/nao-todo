import type { ProjectCardVO } from '../project-card/types'

export type ProjectBoardProps = {
    projects?: ProjectCardVO[]
    loadingState?: boolean
    allowRoute?: boolean
}

export type ProjectBoardEmits = {
    (event: 'archiveProject', projectId: ProjectCardVO['id']): void
    (event: 'unarchiveProject', projectId: ProjectCardVO['id']): void
    (event: 'deleteProject', projectId: ProjectCardVO['id']): void
    (event: 'restoreProject', projectId: ProjectCardVO['id']): void
}