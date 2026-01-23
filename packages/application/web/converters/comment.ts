import type { Comment } from '@nao-todo/types'
import type { CommentEntity } from '@nao-todo/domain/comment'

export const commentEntity2ViewObject = (entity: CommentEntity): Comment => {
    const vo = {} as Comment
    vo.id = entity.id
    vo.taskId = entity.taskId
    vo.content = entity.content
    vo.attachments = entity.attachments
    vo.isTopUp = entity.isTopUp
    vo.createdAt = entity.createdAt
    vo.user = entity.commentUser
    return vo
}
