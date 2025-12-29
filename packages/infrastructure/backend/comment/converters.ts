import { type CommentEntity, makeCommentEntity } from '@nao-todo/domain/comment/entities'
import type { CreateCommentRes, GetCommentRes, ListCommentRes } from '../types'

export const getCommentRes2CommentEntity = (res: GetCommentRes): CommentEntity => {
    const e = makeCommentEntity()
    e.id = res.id
    e.taskId = res.taskId
    e.content = res.content
    e.createdAt = res.createdAt
    e.attachments = res.attachments
    e.isTopUp = res.isTopUp
    e.commentUser = {
        avatar: res.commentUser.avatar,
        nickname: res.commentUser.nickname
    }
    return e
}

export const createCommentRes2CommentEntity = (res: CreateCommentRes): CommentEntity => {
    return getCommentRes2CommentEntity(res)
}

export const listCommentRes2CommentEntities = (res: ListCommentRes): CommentEntity[] => {
    return res.map((comment) => {
        return getCommentRes2CommentEntity(comment)
    })
}
