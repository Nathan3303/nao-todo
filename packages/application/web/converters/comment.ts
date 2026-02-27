import type { Comment, CreateComment, UpdateComment } from '@nao-todo/types'
import type { CommentEntity } from '@nao-todo/domain/comment'
import type { UpdateCommentValueObject } from '@nao-todo/domain/comment/valueobjects'

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

export const createComment2CommentEntity = (vo: CreateComment): CommentEntity => {
    const entity = {} as CommentEntity
    entity.taskId = vo.taskId
    entity.content = vo.content
    entity.attachments = vo.attachments || []
    entity.isTopUp = vo.isTopUp || false
    return entity
}

export const updateComment2ValueObject = (vo: UpdateComment): UpdateCommentValueObject => {
    const entity = {} as CommentEntity
    if (vo.content) entity.content = vo.content
    if (vo.isTopUp !== undefined) entity.isTopUp = vo.isTopUp
    return entity
}
