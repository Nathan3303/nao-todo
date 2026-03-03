import { Project } from '@nao-todo/types'

export type TaskProjectSelectorProps = {
    projects: Project[]
    projectId: Project['id']
    placeholder?: string
    placement?: string
}

export type TaskProjectSelectorEmits = {
    (event: 'select', projectId: Project['id'], projectTitle?: Project['name']): void
}
