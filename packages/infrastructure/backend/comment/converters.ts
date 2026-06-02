import { CommentEntity } from '@nao-todo/domain/comment'
import type { CreateCommentRes, GetCommentRes, ListCommentRes } from '../types'

export const getCommentRes2CommentEntity = (res: GetCommentRes): CommentEntity => {
    return new CommentEntity(
        res.id,
        res.taskId,
        res.content,
        res.createdAt,
        res.attachments,
        res.isTopUp,
        res.avatar,
        res.nickname
    )
}

export const createCommentRes2CommentEntity = (res: CreateCommentRes): CommentEntity => {
    return getCommentRes2CommentEntity(res)
}

export const listCommentRes2CommentEntities = (res: ListCommentRes): CommentEntity[] => {
    return res.map((comment) => {
        return getCommentRes2CommentEntity(comment)
    })
}

