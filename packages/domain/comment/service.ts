import { CommentEntity } from './entities'
import { UpdateCommentValueObject, CreateCommentValueObject } from './valueobjects'
import type { GoAsync } from '@nao-todo/types'
import type { CommentRepository } from './repositories'
import { unwrapError } from '@nao-todo/infrastructure/utils'

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
     * @param createCommentValueObject 创建评论值对象
     * @returns 评论实体
     */
    async create(createCommentValueObject: CreateCommentValueObject): GoAsync<CommentEntity> {
        // 数据校验
        const validateErr = createCommentValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 创建评论
        return this.commentRepo.create(createCommentValueObject)
    }

    /**
     * 更新评论
     * @param commentId 评论 ID
     * @param updateCommentValueObject 更新评论值对象
     * @returns 更新结果
     */
    async update(
        commentId: CommentEntity['id'],
        updateCommentValueObject: UpdateCommentValueObject
    ): GoAsync<string> {
        // 数据校验
        const validateErr = updateCommentValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 更新评论
        return this.commentRepo.update(commentId, updateCommentValueObject)
    }

    /**
     * 删除评论
     * @param commentId 评论 ID
     * @returns 错误信息
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
