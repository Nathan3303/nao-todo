import { t } from '@nao-todo/shared/locales'
import { unwrapErrors } from '@nao-todo/shared/utils/user-facing-go-error'
import { type GoAsync } from '@nao-todo/shared/types'
import { NueMessage } from 'nue-ui'
import type {
    CreateTaskCommentViewObject,
    TaskCommentViewObject,
    UpdateTaskCommentViewObject
} from '@nao-todo/domain-task'
import { TaskCommentUseCase } from '@nao-todo/domain-task'

/**
 * 评论作者信息解析器
 * @description 本地优先下评论写本地库，需由展示层注入当前用户昵称/头像，
 *              否则新增评论立即展示时作者信息为空（DEF-69）。
 */
export type TaskCommentAuthorResolver = () => { nickname?: string; avatar?: string }

/**
 * 任务评论操作器
 * @description 任务评论操作器，用于执行任务评论相关的操作
 */
export class TaskCommentHandler {
    /**
     * 任务评论操作器
     * @description 任务评论操作器，用于执行任务评论相关的操作
     * @param taskCommentUseCase 任务评论使用案例
     * @param resolveAuthor 作者信息解析器（可选；由展示层注入当前用户资料）
     */
    constructor(
        private taskCommentUseCase: TaskCommentUseCase,
        private resolveAuthor?: TaskCommentAuthorResolver
    ) {}

    /**
     * 创建任务评论
     * @description 创建任务评论，包含任务ID和评论内容；
     *              作者信息缺省时由解析器补齐（本地优先下评论行立即可见）
     * @param createViewObject 创建任务评论视图对象
     * @returns 任务评论操作结果
     */
    async create(createViewObject: CreateTaskCommentViewObject): GoAsync<void> {
        if (!createViewObject.taskId) return '参数错误'
        const author = this.resolveAuthor?.() ?? {}
        const [, createError] = await this.taskCommentUseCase.create({
            ...createViewObject,
            nickname: createViewObject.nickname ?? author.nickname,
            avatar: createViewObject.avatar ?? author.avatar
        })
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