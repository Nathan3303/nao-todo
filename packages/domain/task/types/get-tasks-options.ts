// 获取任务列表选项
export type GetTasksOptions = {
    parentTaskId?: string
    name?: string
    description?: string
    state?: string
    priority?: string
    projectId?: string
    tagId?: string
    isArchived?: boolean
    isDeleted?: boolean
    isStarMarked?: boolean
    isGivenUp?: boolean
    sort?: { field: string; order: string }
    relativeDate?: 'today' | 'tomorrow' | 'week' | '-today' | 'month' | '-overdue'
    page?: number
    limit?: number
}

