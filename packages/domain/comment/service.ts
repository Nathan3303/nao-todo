import type { CommentEntity } from './entities'
import type { GoAsync } from '@nao-todo/types'
import type { CommentRepository } from './repositories'
import type { UpdateCommentValueObject } from './valueobjects'

export class CommentDomain {
    /**
     * 评论域构造函数
     * @param commentRepo 评论操作仓库
     */
    constructor(private commentRepo: CommentRepository) {}

    /**
     * 获取评论
     * @param commentId 评论 ID
     * @returns 评论实体
     */
    async get(commentId: CommentEntity['id']): GoAsync<CommentEntity> {
        return this.commentRepo.get(commentId)
    }

    /**
     * 创建评论
     * @param commentEntity 评论实体
     * @returns 评论实体
     */
    async create(commentEntity: CommentEntity): GoAsync<CommentEntity> {
        return this.commentRepo.create(commentEntity)
    }

    /**
     * 更新评论
     * @param commentId 评论 ID
     * @param updateValueObject 更新评论值对象
     * @returns 评论 ID
     */
    async update(
        commentId: CommentEntity['id'],
        updateValueObject: UpdateCommentValueObject
    ): GoAsync<string> {
        return this.commentRepo.update(commentId, updateValueObject)
    }

    /**
     * 删除评论
     * @param commentId 评论 ID
     * @returns 评论 ID
     */
    async remove(commentId: CommentEntity['id']): GoAsync<void> {
        return this.commentRepo.remove(commentId)
    }

    /**
     * 获取评论列表
     * @param taskId 任务 ID
     * @returns 评论实体列表
     */
    async list(taskId: CommentEntity['taskId']): GoAsync<CommentEntity[]> {
        return this.commentRepo.list(taskId)
    }
}
