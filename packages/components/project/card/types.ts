import type { Project } from '@nao-todo/stores'

export type ProjectCardProps = {
    project: Project
    allowRoute?: boolean
}

export type ProjectCardEmits = {
    (event: 'click', project: Project): void
    (event: 'unarchiveProject', projectId: Project['id']): void
}