import type {
    TaskViewObject,
    UpdateTaskViewObject,
    TaskCheckItemViewObject,
    TaskCommentViewObject,
    UpdateTaskCommentViewObject,
    UpdateTaskCheckItemViewObject
} from './viewobjects'

/**
 * 任务用例存储接口
 */
export interface TaskStore {
    /**
     * 设置任务列表
     * @param tasks 任务列表
     */
    setTasks(tasks: TaskViewObject[]): void

    /**
     * 更新任务
     * @param id 任务ID
     * @param updateTaskViewObject 更新任务视图对象
     */
    updateTask(id: TaskViewObject['id'], updateTaskViewObject: UpdateTaskViewObject): void

    /**
     * 添加任务
     * @param task 任务视图对象
     */
    addTask(task: TaskViewObject): void

    /**
     * 添加任务列表
     * @param tasks 任务列表
     */
    addTasks(tasks: TaskViewObject[]): void

    /**
     * 获取任务
     * @param id 任务ID
     * @returns 任务视图对象或undefined
     */
    getTask(id: TaskViewObject['id']): TaskViewObject | void

    /**
     * 删除任务
     * @param id 任务ID
     */
    removeTask(id: TaskViewObject['id']): void
}

/**
 * 任务检查项用例存储接口
 */
export interface TaskCheckItemStore {
    /**
     * 任务检查项列表
     */
    checkItems?: TaskCheckItemViewObject[]

    /**
     * 添加任务检查项
     * @param checkItem 任务检查项视图对象
     */
    addCheckItem: (checkItem: TaskCheckItemViewObject) => void

    /**
     * 获取任务检查项
     * @param id 任务检查项ID
     * @returns 任务检查项视图对象或undefined
     */
    getCheckItem: (id: TaskCheckItemViewObject['id']) => TaskCheckItemViewObject | undefined

    /**
     * 设置任务检查项列表
     * @param checkItems 任务检查项列表
     */
    setCheckItems: (checkItems: TaskCheckItemViewObject[]) => void

    /**
     * 设置任务检查项ID列表
     * @param ids 任务检查项ID列表
     */
    setCheckItemIds: (ids: TaskCheckItemViewObject['id'][]) => void

    /**
     * 添加任务检查项ID
     * @param id 任务检查项ID
     */
    addCheckItemId: (id: TaskCheckItemViewObject['id']) => void

    /**
     * 更新任务检查项
     * @param id 任务检查项ID
     * @param updateViewObject 更新任务检查项视图对象
     */
    updateCheckItem: (
        id: TaskCheckItemViewObject['id'],
        updateViewObject: UpdateTaskCheckItemViewObject
    ) => void

    /**
     * 更新任务检查项列表
     * @param newCheckItems 新的任务检查项列表
     */
    updateCheckItems: (newCheckItems: TaskCheckItemViewObject[]) => void

    /**
     * 删除任务检查项
     * @param id 任务检查项ID
     */
    deleteCheckItem: (id: TaskCheckItemViewObject['id']) => void
}

/**
 * 任务评论用例存储接口
 */
export interface TaskCommentStore {
    /**
     * 任务评论列表
     */
    comments?: TaskCommentViewObject[]

    /**
     * 设置任务评论列表
     * @param comments 任务评论列表
     */
    setComments: (comments: TaskCommentViewObject[]) => void

    /**
     * 设置任务评论ID列表
     * @param ids 任务评论ID列表
     */
    setCommentIds: (ids: TaskCommentViewObject['id'][]) => void

    /**
     * 添加任务评论ID
     * @param id 任务评论ID
     */
    addCommentId: (id: TaskCommentViewObject['id']) => void

    /**
     * 删除任务评论ID
     * @param id 任务评论ID
     */
    removeCommentId: (id: TaskCommentViewObject['id']) => void

    /**
     * 添加任务评论
     * @param comment 任务评论视图对象
     */
    addComment: (comment: TaskCommentViewObject) => void

    /**
     * 更新任务评论
     * @param id 任务评论ID
     * @param updateViewObject 更新任务评论视图对象
     */
    updateComment: (
        id: TaskCommentViewObject['id'],
        updateViewObject: UpdateTaskCommentViewObject
    ) => void

    /**
     * 删除任务评论
     * @param id 任务评论ID
     */
    removeComment: (id: TaskCommentViewObject['id']) => void
}

