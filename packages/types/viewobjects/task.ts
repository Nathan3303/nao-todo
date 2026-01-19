import type { Project } from './project'
import type { Tag } from './tag'

export type Task = {
    id: string
    projectId: Project['id']
    name: string
    description: string
    state: 'todo' | 'in-progress' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    tags: Tag['id'][]
    startAt?: string | null
    endAt?: string | null
    isDeleted: boolean
    deletedAt: string | null
    isArchived: boolean
    archivedAt: string | null
    isFavorited: boolean
    isGivenUp: boolean
    createdAt: string
    updatedAt: string
    // Additional fields
    project?: { name: Project['name'] }
    events?: Event[]
}

export type CreateTask = {
    projectId?: Task['projectId']
    name: Task['name']
    description?: Task['description']
    state: Task['state']
    priority: Task['priority']
    startAt?: Task['startAt']
    endAt: Task['endAt']
    tags?: Task['tags']
}

export type UpdateTaskOptions = {
    projectId?: Task['projectId']
    name?: Task['name']
    description?: Task['description']
    state?: Task['state']
    priority?: Task['priority']
    startAt?: Task['startAt']
    endAt?: Task['endAt']
    isDeleted?: Task['isDeleted']
    isArchived?: Task['isArchived']
    isFavorited?: Task['isFavorited']
    isGivenUp?: Task['isGivenUp']
    tags?: Task['tags']
}

export type GetTasksOptions = {
    projectId?: Task['projectId']
    name?: Task['name']
    description?: Task['description']
    state?: string
    priority?: string
    isArchived?: Task['isArchived']
    isDeleted?: Task['isDeleted']
    isFavorited?: Task['isFavorited']
    isGivenUp?: Task['isGivenUp']
    sort?: GetTasksSortOptions
    relativeDate?: 'today' | 'tomorrow' | 'week' | '-today' | 'month'
    tagId?: Tag['id']
    page?: number
    limit?: number
}

export type GetTasksSortOptions = {
    field: string
    order: string
}

export type TaskColumnOptions = {
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
    project?: boolean
    description?: boolean
    state?: boolean
    priority?: boolean
    tags?: boolean
    startAt?: boolean
    endAt?: boolean
    isDeleted?: boolean
    isArchived?: boolean
    archivedAt?: boolean
    isFavorited?: boolean
    isGivenUp?: boolean
}
