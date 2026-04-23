import type { ProjectViewObject } from '@nao-todo/types'

export type ProjectCardProps = {
    project: ProjectViewObject
    allowRoute?: boolean
}

export type ProjectCardEmits = {
    (event: 'click', project: ProjectViewObject): void
    (event: 'unarchiveProject', projectId: ProjectViewObject['id']): void
}

