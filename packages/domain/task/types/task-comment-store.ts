import type { TaskCommentViewObject, UpdateTaskCommentViewObject } from "./viewobjects"

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

