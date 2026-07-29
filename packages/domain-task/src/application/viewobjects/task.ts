import type { ViewObjectBase, NullableDateString, NullableString } from '@nao-todo/shared'

// --- Task ---

// 任务视图对象
export type TaskViewObject = ViewObjectBase & {
    parentTaskId: NullableString
    userId: string
    name: string
    description: string
    state: string
    priority: string
    startAt: NullableDateString
    endAt: NullableDateString
    projectId: NullableString
    tags: string[]
    archivedAt: NullableDateString
    starMarkAt: NullableDateString
    givenUpAt: NullableDateString
    remindAt: NullableDateString
    remindRepeat: 'none' | 'daily' | 'weekly' | 'monthly'
    remindTime: NullableDateString
    remindWeekdays: number[]
    // 额外属性
    // project?: { name: string }
    // events?: Event[]
    isDeleted: boolean
    isArchived: boolean
    isStarMarked: boolean
    isGivenUp: boolean
}

// 创建任务视图对象
export type CreateTaskViewObject = {
    parentTaskId?: TaskViewObject['parentTaskId']
    name: TaskViewObject['name']
    description: TaskViewObject['description']
    state: TaskViewObject['state']
    priority: TaskViewObject['priority']
    startAt: TaskViewObject['startAt']
    endAt: TaskViewObject['endAt']
    projectId: TaskViewObject['projectId']
    tags: TaskViewObject['tags']
    remindAt: TaskViewObject['remindAt']
    remindRepeat: TaskViewObject['remindRepeat']
    remindTime: TaskViewObject['remindTime']
    remindWeekdays: TaskViewObject['remindWeekdays']
}

// 更新任务视图对象
export type UpdateTaskViewObject = {
    // id: TaskViewObject['id'] // 任务 ID， 必须指定
    updatedAt?: TaskViewObject['updatedAt']
    deletedAt?: TaskViewObject['deletedAt']
    parentTaskId?: TaskViewObject['parentTaskId']
    name?: TaskViewObject['name']
    description?: TaskViewObject['description']
    state?: TaskViewObject['state']
    priority?: TaskViewObject['priority']
    startAt?: TaskViewObject['startAt']
    endAt?: TaskViewObject['endAt']
    projectId?: TaskViewObject['projectId']
    tags?: TaskViewObject['tags']
    archivedAt?: TaskViewObject['archivedAt']
    starMarkAt?: TaskViewObject['starMarkAt']
    givenUpAt?: TaskViewObject['givenUpAt']
    remindAt?: TaskViewObject['remindAt']
    remindRepeat?: TaskViewObject['remindRepeat']
    remindTime?: TaskViewObject['remindTime']
    remindWeekdays?: TaskViewObject['remindWeekdays']
    // 额外属性
    // project?: { name: string }
    // events?: Event[]
    isDeleted?: boolean
    isArchived?: boolean
    isStarMarked?: boolean
    isGivenUp?: boolean
}



// 任务标签视图对象
export type TaskTagViewObject = {
    id: string
    name: string
    color: string
}

// 任务项目视图对象
export type TaskProjectViewObject = {
    id: string
    name: string
    icon: string
}

// --- Task Check Item ---

// 任务检查事项视图对象
export type TaskCheckItemViewObject = ViewObjectBase & {
    taskId: TaskViewObject['id']
    name: string
    description: NullableString
    isDone: boolean
    sortId: number
}

// 创建任务检查事项视图对象
export type CreateTaskCheckItemViewObject = {
    taskId: TaskCheckItemViewObject['taskId']
    name: TaskCheckItemViewObject['name']
    description?: TaskCheckItemViewObject['description']
}

// 更新任务检查事项视图对象
export type UpdateTaskCheckItemViewObject = {
    // id: TaskCheckItemViewObject['id'] // 检查事项 ID， 必须指定
    name?: TaskCheckItemViewObject['name']
    description?: TaskCheckItemViewObject['description']
    isDone?: TaskCheckItemViewObject['isDone']
    sortId?: TaskCheckItemViewObject['sortId']
}

// 批量更新任务检查事项视图对象
export type BatchUpdateTaskCheckItemViewObject = UpdateTaskCheckItemViewObject[]

// --- Task Comment ---

// 任务评论视图对象
export type TaskCommentViewObject = ViewObjectBase & {
    taskId: TaskViewObject['id']
    content: string
    attachments: string[]
    isTopUp: boolean
    avatar: string
    nickname: string
}

// 创建任务评论视图对象
export type CreateTaskCommentViewObject = {
    taskId: TaskCommentViewObject['taskId']
    content: TaskCommentViewObject['content']
    attachments?: TaskCommentViewObject['attachments']
    isTopUp?: TaskCommentViewObject['isTopUp']
}

// 更新任务评论视图对象
export type UpdateTaskCommentViewObject = {
    // id: TaskCheckItemViewObject['id'] // 检查事项 ID， 必须指定
    content?: TaskCommentViewObject['content']
    isTopUp?: TaskCommentViewObject['isTopUp']
}
