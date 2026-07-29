import type { TaskViewObject, TaskCheckItemViewObject, UpdateTaskCheckItemViewObject, TaskCommentViewObject, UpdateTaskCommentViewObject } from './viewobjects/task'

// 任务存储接口
export type TaskStore = {
    tasks: TaskViewObject[]
    setTasks: (tasks: TaskViewObject[]) => void
    updateTask: (id: string, update: Partial<TaskViewObject>) => void
    addTask: (task: TaskViewObject) => void
    addTasks: (tasks: TaskViewObject[]) => void
    getTask: (id: string) => TaskViewObject | undefined
    removeTask: (id: string) => void
}

// 任务检查项存储接口
export type TaskCheckItemStore = {
    checkItems: TaskCheckItemViewObject[]
    addCheckItem: (item: TaskCheckItemViewObject) => void
    getCheckItem: (id: string) => TaskCheckItemViewObject | undefined
    setCheckItems: (items: TaskCheckItemViewObject[]) => void
    updateCheckItem: (id: string, update: Partial<UpdateTaskCheckItemViewObject>) => void
    deleteCheckItem: (id: string) => void
    updateCheckItems: (items: TaskCheckItemViewObject[]) => void
    checkItemIds: string[]
    setCheckItemIds: (ids: string[]) => void
    addCheckItemId: (id: string) => void
    removeCheckItemId: (id: string) => void
}

// 任务评论存储接口
export type TaskCommentStore = {
    setComments: (comments: TaskCommentViewObject[]) => void
    getComment: (id: string) => TaskCommentViewObject | undefined
    addComment: (comment: TaskCommentViewObject) => void
    updateComment: (id: string, update: Partial<UpdateTaskCommentViewObject>) => void
    removeComment: (id: string) => void
    commentIds: string[]
    setCommentIds: (ids: string[]) => void
    addCommentId: (id: string) => void
    removeCommentId: (id: string) => void
}
