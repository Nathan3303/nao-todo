import type { Project } from '@nao-todo/types'

export type TodoProjectSelectorProps = {
    userId: Project['userId']
    projects: Project[]
    projectId?: Project['id']
    placeholder?: string
}

export type TodoProjectSelectorEmits = {
    (event: 'select', projectId: Project['id'], projectTitle: Project['title']): void
}
