import type { GoAsync, CreateTask, Project, Tag } from '@nao-todo/types'

export type TaskCreatorVO = {
    projectId?: CreateTask['projectId']
    name: CreateTask['name']
    description?: CreateTask['description']
    state: CreateTask['state']
    priority: CreateTask['priority']
    startAt?: CreateTask['startAt']
    endAt: CreateTask['endAt']
    tags?: CreateTask['tags']
    creating: boolean
    disabled: boolean
}

export type TaskCreatorProps = {
    avaliableProjects?: Project[]
    avaliableTags?: Tag[]
    createTaskHandler: (createVO: CreateTask) => GoAsync<string>
}

export type TaskCreatorEmits = {
    (e: 'register', open: (createTaskOptions: CreateTask) => void, close: () => void): void
}
