export type TaskViewObject = {
    id: string
    localId: string
    serverId: string | null
    parentTaskId: string | null
    userId: string
    name: string
    description: string
    state: string
    priority: string
    startAt: string
    endAt: string
    projectId: string
    tags: string[]
    archivedAt: string | null
    starMarkAt: string | null
    givenUpAt: string | null
    isDeleted: boolean
    isArchived: boolean
    isStarMarked: boolean
    isGivenUp: boolean
    project?: { name: string }
    events?: Event[]
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export type CreateTaskViewObject = {
    projectId: TaskViewObject['projectId']
    name: TaskViewObject['name']
    description?: TaskViewObject['description']
    state: TaskViewObject['state']
    priority: TaskViewObject['priority']
    startAt: TaskViewObject['startAt'] | null
    endAt: TaskViewObject['endAt'] | null
    tags?: TaskViewObject['tags']
    isStarMarked?: boolean
}

export type UpdateTaskViewObject = {
    projectId?: TaskViewObject['projectId']
    name?: TaskViewObject['name']
    description?: TaskViewObject['description']
    state?: TaskViewObject['state']
    priority?: TaskViewObject['priority']
    startAt?: TaskViewObject['startAt']
    endAt?: TaskViewObject['endAt']
    isDeleted?: TaskViewObject['isDeleted']
    isArchived?: TaskViewObject['isArchived']
    isStarMarked?: TaskViewObject['isStarMarked']
    isGivenUp?: TaskViewObject['isGivenUp']
    givenUpAt?: TaskViewObject['givenUpAt']
    tags?: TaskViewObject['tags']
    deletedAt?: TaskViewObject['deletedAt']
}

export type GetTasksOptions = {
    projectId?: TaskViewObject['projectId']
    name?: TaskViewObject['name']
    description?: TaskViewObject['description']
    state?: TaskViewObject['state']
    priority?: TaskViewObject['priority']
    isArchived?: TaskViewObject['isArchived']
    isDeleted?: TaskViewObject['isDeleted']
    isStarMarked?: TaskViewObject['isStarMarked']
    isGivenUp?: TaskViewObject['isGivenUp']
    sort?: GetTasksSortOptions
    relativeDate?: 'today' | 'tomorrow' | 'week' | '-today' | 'month'
    tagId?: string
    page?: number
    limit?: number
}

export type GetTasksSortOptions = { field: string; order: string }

export type TaskColumnOptions = {
    name: boolean
    description: boolean
    state: boolean
    priority: boolean
    startAt: boolean
    endAt: boolean
    project: boolean
    tags: boolean
    givenUpAt: boolean
    starMarkAt: boolean
    archivedAt: boolean
    createdAt: boolean
    updatedAt: boolean
    deletedAt: boolean
}

export type TaskSortFields = {
    name: boolean
    state: boolean
    priority: boolean
    startAt: boolean
    endAt: boolean
    tags: boolean
    givenUpAt: boolean
    starMarkAt: boolean
    archivedAt: boolean
    createdAt: boolean
    updatedAt: boolean
    deletedAt: boolean
}

