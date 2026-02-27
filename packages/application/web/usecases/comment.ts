import { CommentDomain } from '@nao-todo/domain/comment'
import type { Task, Comment, GoAsync, CreateComment, UpdateComment } from '@nao-todo/types'
import {
    commentEntity2ViewObject,
    createComment2CommentEntity,
    updateComment2ValueObject
} from '../converters/comment'

export interface CommentStore {
    setComments: (comments: Comment[]) => void
    setCommentIds: (commentIds: Comment['id'][]) => void
    addCommentId: (commentId: Comment['id']) => void
    removeCommentId: (commentId: Comment['id']) => void
    addComment: (comment: Comment) => void
    updateComment: (commentId: Comment['id'], updateComment: UpdateComment) => void
    removeComment: (commentId: Comment['id']) => void
}

export class CommentUseCase {
    /**
     * 评论用例
     * @param commentDomain 评论域服务
     * @param store 评论存储
     */
    constructor(
        private commentDomain: CommentDomain,
        private store: CommentStore
    ) {}

    /**
     * 加载任务评论
     * @param taskId 任务 ID
     * @returns 评论 ID 列表
     */
    async loadComments(taskId: Task['id']): GoAsync<Comment['id'][]> {
        // 1. 参数校验
        if (!taskId) {
            return [null, '参数错误']
        }
        // 2. 调用域服务
        const [commentEntities, err] = await this.commentDomain.list(taskId)
        if (err !== null) {
            return [null, err]
        }
        // 3. 转换为视图对象
        const comments = commentEntities.map(commentEntity2ViewObject)
        const commentIds = comments.map((comment) => comment.id)
        // 4. 设置评论
        this.store.setComments(comments)
        this.store.setCommentIds(commentIds)
        // 5. 返回评论 ID 列表
        return [commentIds, null]
    }

    /**
     * 创建评论
     * @param createComment 创建评论视图对象
     * @returns 评论 ID
     */
    async create(createComment: CreateComment): GoAsync<Comment['id']> {
        // 1. 参数校验
        if (!createComment.taskId || !createComment.content) {
            return [null, '参数错误']
        }
        // 2. 调用域服务
        const [commentEntity, err] = await this.commentDomain.create(
            createComment2CommentEntity(createComment)
        )
        if (err !== null) {
            return [null, err]
        }
        // 3. 转换为视图对象
        const comment = commentEntity2ViewObject(commentEntity)
        // 4. 设置评论
        this.store.addComment(comment)
        this.store.addCommentId(comment.id)
        // 5. 返回评论 ID
        return [comment.id, null]
    }

    /**
     * 更新评论
     * @param commentId 评论 ID
     * @param updateComment 更新评论视图对象
     * @returns 评论 ID
     */
    async update(commentId: Comment['id'], updateComment: UpdateComment): GoAsync<Comment['id']> {
        // 1. 参数校验
        if (!commentId || (!updateComment.content && !updateComment.isTopUp)) {
            return [null, '参数错误']
        }
        // 2. 调用域服务
        const updateValueObject = updateComment2ValueObject(updateComment)
        const [updatedId, err] = await this.commentDomain.update(commentId, updateValueObject)
        if (err !== null) {
            return [null, err]
        }
        // 3. 更新评论
        this.store.updateComment(commentId, updateComment)
        // 4. 返回评论 ID
        return [updatedId, null]
    }

    /**
     * 删除评论
     * @param commentId 评论 ID
     * @returns 评论 ID
     */
    async delete(commentId: Comment['id']): GoAsync<Comment['id']> {
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
