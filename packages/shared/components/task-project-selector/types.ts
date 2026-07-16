import type { ProjectViewObject } from '@nao-todo/usecases/project'

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

