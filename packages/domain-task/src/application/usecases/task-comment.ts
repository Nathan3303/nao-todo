// import {
//     newTaskCommentRepository,
//     TaskCommentRepoImpl
// } from '@nao-todo/infrastructure/backend/task'

import type { GoAsync } from '@nao-todo/shared/types'
import { TaskCommentRepository } from '../../domain/repositories'
import type {
    CreateTaskCommentViewObject,
    TaskCheckItemViewObject,
    TaskCommentViewObject,
    TaskViewObject,
    UpdateTaskCommentViewObject
} from '../viewobjects'
import type { TaskCommentStore } from '../stores'
import {
    createTaskCommentViewObjectToValueObject,
    taskCommentEntityToViewObject,
    updateTaskCommentViewObjectToValueObject
} from './converters'
// import { getRequesterImpl } from '@nao-todo/infrastructure/requester'

/**
 * 任务评论使用案例
 */
export class TaskCommentUseCase {
    /**
     * 任务评论使用案例
     * @param taskCommentRepo 任务评论仓库
     * @param taskCommentStore 任务评论存储
     */
    constructor(
        // private taskCommentDomain: TaskCommentDomain,
        private taskCommentRepo: TaskCommentRepository,
        private taskCommentStore: TaskCommentStore
    ) {}

    /**
     * 加载任务评论
     * @param taskId 任务 ID
     * @returns 评论 ID 列表
     */
    async list(taskId: TaskViewObject['id']): GoAsync<TaskCheckItemViewObject['id'][]> {
        // 参数校验
        if (!taskId) return [null, '参数错误']
        // 调用域服务
        const [commentEntities, err] = await this.taskCommentRepo.list(taskId)
        if (err !== null) return [null, err]
        // 转换为视图对象
        const comments = commentEntities.map(taskCommentEntityToViewObject)
        const commentIds = comments.map((comment) => comment.id)
        // 设置评论到本地
        this.taskCommentStore.setComments(comments)
        this.taskCommentStore.setCommentIds(commentIds)
        // 返回评论 ID 列表
        return [commentIds, null]
    }

    /**
     * 创建任务评论
     * @param createViewObject 创建任务评论视图对象
     * @returns 评论 ID
     */
    async create(
        createViewObject: CreateTaskCommentViewObject
    ): GoAsync<TaskCommentViewObject['id']> {
        // 1. 参数校验
        if (!createViewObject.taskId || !createViewObject.content) {
            return [null, '参数错误']
        }
        // 2. 调用域服务
        const [commentEntity, err] = await this.taskCommentRepo.create(
            createTaskCommentViewObjectToValueObject(createViewObject)
        )
        if (err !== null) {
            return [null, err]
        }
        // 3. 转换为视图对象
        const comment = taskCommentEntityToViewObject(commentEntity)
        // 4. 设置评论
        this.taskCommentStore.addComment(comment)
        this.taskCommentStore.addCommentId(comment.id)
        // 5. 返回评论 ID
        return [comment.id, null]
    }

    /**
     * 更新任务评论
     * @param id 评论 ID
     * @param updateViewObject 更新评论视图对象
     * @returns 评论 ID
     */
    async update(
        id: TaskCommentViewObject['id'],
        updateViewObject: UpdateTaskCommentViewObject
    ): GoAsync<void> {
        // 1. 转换为值对象
        const updateValueObject = updateTaskCommentViewObjectToValueObject(id, updateViewObject)
        // 2. 调用域服务
        const updateError = await this.taskCommentRepo.update(updateValueObject)
        if (updateError !== null) return updateError
        // 3. 更新评论
        this.taskCommentStore.updateComment(id, updateViewObject)
        // 4. 返回评论 ID
        return null
    }

    /**
     * 删除任务评论
     * @param id 评论 ID
     * @returns 评论 ID
     */
    async delete(id: TaskCommentViewObject['id']): GoAsync<TaskCommentViewObject['id']> {
        // 1. 参数校验
        if (!id) return [null, '参数错误']
        // 2. 调用域服务
        const err = await this.taskCommentRepo.delete(id)
        if (err !== null) return [null, err]
        // 3. 删除评论
        this.taskCommentStore.removeComment(id)
        this.taskCommentStore.removeCommentId(id)
        // 4. 返回评论 ID
        return [id, null]
    }
}

/**
 * 创建任务评论使用案例
 * @param store 任务评论存储
 * @returns 任务评论使用案例
 */
// export const newTaskCommentUseCase = (store: TaskCommentStore): TaskCommentUseCase => {
//     const requester = getRequesterImpl()
//     const repo = newTaskCommentRepository(requester)
//     return new TaskCommentUseCase(repo, store)
// }