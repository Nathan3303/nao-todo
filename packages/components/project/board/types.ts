import type { Project } from '@/stores/use-project-store/v2/types'

export type ProjectBoardProps = {
    projects?: Project[]
    loadingState?: boolean
    allowRoute?: boolean
}

export type ProjectBoardEmits = {
    (event: 'archiveProject', projectId: Project['id']): void
    (event: 'unarchiveProject', projectId: Project['id']): void
    (event: 'deleteProject', projectId: Project['id']): void
    (event: 'restoreProject', projectId: Project['id']): void
    (event: 'deleteProjectPermanently', projectId: Project['id']): void
}
