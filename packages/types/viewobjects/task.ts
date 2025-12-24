import type { ProjectVO } from './project'
import type { TagVO } from './tag'

export type TaskVO = {
    id: string
    projectId: ProjectVO['id']
    name: string
    description: string
    state: 'todo' | 'in-progress' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    tags: TagVO['id'][]
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
    project?: { name: ProjectVO['name'] }
    events?: Event[]
}

export type UpdateTaskVO = {
    name?: TaskVO['name']
    description?: TaskVO['description']
    state?: TaskVO['state']
    priority?: TaskVO['priority']
    startAt?: TaskVO['startAt']
    endAt?: TaskVO['endAt']
    isArchived?: TaskVO['isArchived']
    isFavorited?: TaskVO['isFavorited']
    isGivenUp?: TaskVO['isGivenUp']
    tags?: TaskVO['tags']
}

export type GetTasksOptions = {
    projectId?: TaskVO['projectId']
    name?: TaskVO['name']
    description?: TaskVO['description']
    state?: string
    priority?: string
    isArchived?: TaskVO['isArchived']
    isDeleted?: TaskVO['isDeleted']
    isFavorited?: TaskVO['isFavorited']
    isGivenUp?: TaskVO['isGivenUp']
    sort?: GetTasksSortOptions
    relativeDate?: 'today' | 'tomorrow' | 'week' | '-today' | 'month'
    tagId?: TagVO['id']
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
