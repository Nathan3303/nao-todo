import { t, unwrapErrors, type GoAsync, type Subscriber } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import type {
    CreateTaskCommentViewObject,
    TaskCommentViewObject,
    UpdateTaskCommentViewObject
} from '@nao-todo/application/task/viewobjects'
import { TaskCommentUseCase } from '@nao-todo/application/task/usecases'

/**
 * 任务评论操作器
 * @description 任务评论操作器，用于执行任务评论相关的操作
 */
export class TaskCommentHandler {
    /**
     * 任务评论操作器
     * @description 任务评论操作器，用于执行任务评论相关的操作
     * @param taskCommentUseCase 任务评论使用案例
     * @param subscriber 事件订阅器

     */
    constructor(
        private taskCommentUseCase: TaskCommentUseCase,
        private subscriber: Subscriber
    ) {}

    /**
     * 创建任务评论
     * @description 创建任务评论，包含任务ID和评论内容
     * @param createViewObject 创建任务评论视图对象
     * @returns 任务评论操作结果
     */
    async create(createViewObject: CreateTaskCommentViewObject): GoAsync<void> {
        if (!createViewObject.taskId) return '参数错误'
        const [, createError] = await this.taskCommentUseCase.create(createViewObject)
        if (createError !== null) {
            NueMessage.error(
                t('task.comment.createFailed', { error: `(${unwrapErrors(createError)})` })
            )
            return createError
        }
        NueMessage.success(t('task.comment.createSuccess'))
        return null
    }

    /**
     * 更新任务评论
     * @param id 任务评论ID
     * @param updateViewObject 更新任务评论视图对象
     * @returns 任务评论操作结果
     */
    async update(
        id: TaskCommentViewObject['id'],
        updateViewObject: UpdateTaskCommentViewObject
    ): GoAsync<void> {
        if (!id) return '参数错误'
        const updateError = await this.taskCommentUseCase.update(id, updateViewObject)
        if (updateError !== null) {
            NueMessage.error(
                t('task.comment.updateFailed', { error: `(${unwrapErrors(updateError)})` })
            )
            return updateError
        }
        NueMessage.success(t('task.comment.updateSuccess'))
        return null
    }

    /**
     * 删除任务评论
     * @param id 任务评论ID
     * @returns 任务评论操作结果
     */
    async delete(id: TaskCommentViewObject['id']): GoAsync<void> {
        if (!id) return '参数错误'
        const [, deleteError] = await this.taskCommentUseCase.delete(id)
        if (deleteError !== null) {
            NueMessage.error(
                t('task.comment.deleteFailed', { error: `(${unwrapErrors(deleteError)})` })
            )
            return deleteError
        }
        NueMessage.success(t('task.comment.deleteSuccess'))
        return null
    }
}
