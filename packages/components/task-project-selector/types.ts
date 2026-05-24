import { ProjectViewObject } from '@nao-todo/types'

export type TaskProjectSelectorProps = {
    projects: ProjectViewObject[]
    projectId: ProjectViewObject['id']
    placeholder?: string
    placement?: string
}

export type TaskProjectSelectorEmits = {
    (
        event: 'select',
        projectId: ProjectViewObject['id'],
        projectTitle?: ProjectViewObject['name']
    ): void
}
