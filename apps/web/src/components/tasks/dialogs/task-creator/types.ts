import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import type {
    GoAsync,
    CreateTaskViewObject,
    ProjectViewObject,
    TagViewObject
} from '@nao-todo/types'

export type TaskCreatorVO = {
    projectId: CreateTaskViewObject['projectId']
    name: CreateTaskViewObject['name']
    description?: CreateTaskViewObject['description']
    state: CreateTaskViewObject['state']
    priority: CreateTaskViewObject['priority']
    startAt?: CreateTaskViewObject['startAt']
    endAt: CreateTaskViewObject['endAt']
    tags?: CreateTaskViewObject['tags']
    creating: boolean
    disabled: boolean
}

export type TaskCreatorProps = {
    avaliableProjects?: ProjectViewObject[]
    avaliableTags?: TagViewObject[]
    createTaskHandler: (createVO: CreateTaskViewObject) => GoAsync<string>
    subscriber?: Subscriber
}

export type TaskCreatorEmits = {
    (
        e: 'register',
        open: (createTaskOptions: CreateTaskViewObject) => void,
        close: () => void
    ): void
}
