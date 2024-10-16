import type { Project } from '@/stores'

export type TodoProjectSelectorProps = {
    userId: Project['userId']
    projects: Project[]
    projectId?: Project['id']
    projectTitle?: Project['title']
    placeholder?: string
}

export type TodoProjectSelectorEmits = {
    (event: 'select', projectId: Project['id'], projectTitle: Project['title']): void
}
