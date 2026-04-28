import { CommentDomain } from '@nao-todo/domain/comment'
import type {
    Task,
    CommentViewObject,
    GoAsync,
    CreateCommentViewObject,
    UpdateCommentViewObject
} from '@nao-todo/types'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useCommentRepository } from '@nao-todo/infrastructure/backend/comment/repoImpl'
import {
    commentEntityToViewObject,
    createCommentViewObjectToValueObject,
    updateCommentViewObjectToValueObject
} from '../converters/comment'

export interface CommentStore {
    setComments: (comments: CommentViewObject[]) => void
    setCommentIds: (commentIds: CommentViewObject['id'][]) => void
    addCommentId: (commentId: CommentViewObject['id']) => void
    removeCommentId: (commentId: CommentViewObject['id']) => void
    addComment: (comment: CommentViewObject) => void
    updateComment: (
        commentId: CommentViewObject['id'],
        updateCommentViewObject: UpdateCommentViewObject
    ) => void
    removeComment: (commentId: CommentViewObject['id']) => void
}

/**
 * 评论用例
 * @description 评论用例负责处理评论相关的业务逻辑
 */
export class CommentUseCase {
    /**
     * 评论用例构造函数
     * @param commentDomain 评论域服务
     * @param store 评论存储
     */
    constructor(
        private commentDomain: CommentDomain,
        private store: CommentStore
    ) {}

    /**
     * 创建评论用例实例（静态工厂方法）
     * @param commentStore 评论存储
     * @returns 评论用例实例
     */
    static create(commentStore: CommentStore): CommentUseCase {
        const requester = getRequesterImpl()
        const repo = useCommentRepository(requester)
        const domain = new CommentDomain(repo)
        return new CommentUseCase(domain, commentStore)
    }

    /**
     * 加载任务评论
     * @param taskId 任务 ID
     * @returns 评论 ID 列表
     */
    async loadComments(taskId: Task['id']): GoAsync<CommentViewObject['id'][]> {
        // 参数校验
        if (!taskId) return [null, '参数错误']
        // 调用域服务
        const [commentEntities, err] = await this.commentDomain.list(taskId)
        if (err !== null) return [null, err]
        // 转换为视图对象
        const comments = commentEntities.map(commentEntityToViewObject)
        const commentIds = comments.map((comment) => comment.id)
        // 设置评论
        this.store.setComments(comments)
        this.store.setCommentIds(commentIds)
        // 返回评论 ID 列表
        return [commentIds, null]
    }

    /**
     * 创建评论
     * @param createComment 创建评论视图对象
     * @returns 评论 ID
     */
    async create(createComment: CreateCommentViewObject): GoAsync<CommentViewObject['id']> {
        // 1. 参数校验
        if (!createComment.taskId || !createComment.content) {
            return [null, '参数错误']
        }
        // 2. 调用域服务
        const [commentEntity, err] = await this.commentDomain.create(
            createCommentViewObjectToValueObject(createComment)
        )
        if (err !== null) {
            return [null, err]
        }
        // 3. 转换为视图对象
        const comment = commentEntityToViewObject(commentEntity)
        // 4. 设置评论
        this.store.addComment(comment)
        this.store.addCommentId(comment.id)
        // 5. 返回评论 ID
        return [comment.id, null]
    }

    /**
     * 更新评论
     * @param commentId 评论 ID
     * @param updateCommentViewObject 更新评论视图对象
     * @returns 评论 ID
     */
    async update(
        commentId: CommentViewObject['id'],
        updateCommentViewObject: UpdateCommentViewObject
    ): GoAsync<CommentViewObject['id']> {
        // 1. 参数校验
        if (!commentId || (!updateCommentViewObject.content && !updateCommentViewObject.isTopUp)) {
            return [null, '参数错误']
        }
        // 2. 调用域服务
        const updateValueObject = updateCommentViewObjectToValueObject(updateCommentViewObject)
        const [updatedId, err] = await this.commentDomain.update(commentId, updateValueObject)
        if (err !== null) {
            return [null, err]
        }
        // 3. 更新评论
        this.store.updateComment(commentId, updateCommentViewObject)
        // 4. 返回评论 ID
        return [updatedId, null]
    }

    /**
     * 删除评论
     * @param commentId 评论 ID
     * @returns 评论 ID
     */
    async delete(commentId: CommentViewObject['id']): GoAsync<CommentViewObject['id']> {
        // 1. 参数校验
        if (!commentId) {
            return [null, '参数错误']
        }
        // 2. 调用域服务
        const err = await this.commentDomain.remove(commentId)
        if (err !== null) {
            return [null, err]
        }
        // 3. 删除评论
        this.store.removeComment(commentId)
        this.store.removeCommentId(commentId)
        // 4. 返回评论 ID
        return [commentId, null]
    }
}

