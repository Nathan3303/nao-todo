import type { TaskProjectViewObject } from '@nao-todo/application/task/viewobjects'

export type TaskProjectSelectorProps = {
    projects: TaskProjectViewObject[]
    projectId: TaskProjectViewObject['id']
    placeholder?: string
    placement?: string
}

export type TaskProjectSelectorEmits = {
    (
        event: 'select',
        projectId: TaskProjectViewObject['id'],
        projectTitle?: TaskProjectViewObject['name']
    ): void
}
