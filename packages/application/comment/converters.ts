import type { CommentEntity } from '@nao-todo/domain/comment'
import type { CommentVO, UpdateCommentVO } from '@nao-todo/types/viewobjects/comment'

export const commentEntity2VO = (entity: CommentEntity): CommentVO => {
    const vo = {} as CommentVO
    vo.id = entity.id
    vo.taskId = entity.taskId
    vo.content = entity.content
    vo.attachments = entity.attachments
    vo.isTopUp = entity.isTopUp
    vo.createdAt = entity.createdAt
    vo.user = entity.commentUser
    return vo
}

export const commentEntities2VOs = (entities: CommentEntity[]): CommentVO[] => {
    return entities.map((e) => commentEntity2VO(e))
}

export const updateCommentVO2Entity = (vo: UpdateCommentVO): CommentEntity => {
    const entity = {} as CommentEntity
    entity.content = vo.content
    entity.isTopUp = vo.isTopUp
    return entity
}
