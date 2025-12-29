import type { GoAsync, CreateTaskVO, ProjectVO, TagVO } from '@nao-todo/types'

export type TaskCreatorVO = {
    projectId?: CreateTaskVO['projectId']
    name: CreateTaskVO['name']
    description?: CreateTaskVO['description']
    state: CreateTaskVO['state']
    priority: CreateTaskVO['priority']
    startAt?: CreateTaskVO['startAt']
    endAt: CreateTaskVO['endAt']
    tags?: CreateTaskVO['tags']
    creating: boolean
    disabled: boolean
}

export type TaskCreatorProps = {
    avaliableProjects?: ProjectVO[]
    avaliableTags?: TagVO[]
    createTaskHandler: (createVO: CreateTaskVO) => GoAsync<string>
}

export type TaskCreatorEmits = {
    (e: 'register', open: (createTaskOptions: CreateTaskVO) => void, close: () => void): void
}