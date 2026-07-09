import type { ProjectViewObject } from '@nao-todo/usecases/project'

export type ProjectBoardProps = {
    projects?: ProjectViewObject[]
    loadingState?: boolean
    allowRoute?: boolean
}

export type ProjectBoardEmits = {
    (event: 'archiveProject', projectId: ProjectViewObject['id']): void
    (event: 'unarchiveProject', projectId: ProjectViewObject['id']): void
    (event: 'deleteProject', projectId: ProjectViewObject['id']): void
    (event: 'restoreProject', projectId: ProjectViewObject['id']): void
}

