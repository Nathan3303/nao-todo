import { CommentDomain } from '@nao-todo/domain/comment'
import type { Task, Comment, GoAsync } from '@nao-todo/types'
import { commentEntity2ViewObject } from '../converters/comment'

export interface CommentStore {
    setComments: (comments: Comment[]) => void
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
        // 4. 设置评论
        this.store.setComments(comments)
        // 5. 返回评论 ID 列表
        return [comments.map((comment) => comment.id), null]
    }
}
