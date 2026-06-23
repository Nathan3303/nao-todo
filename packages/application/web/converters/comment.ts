import type {
    CommentViewObject,
    CreateCommentViewObject,
    UpdateCommentViewObject
} from '@nao-todo/types'
import type { CommentEntity } from '@nao-todo/domain/comment'
import { UpdateCommentValueObject, CreateCommentValueObject } from '@nao-todo/domain/comment'

/**
 * 将评论实体转换为评论视图对象
 * @param entity 评论实体
 * @returns 评论视图对象
 */
export const commentEntityToViewObject = (entity: CommentEntity): CommentViewObject => {
    const commentViewObject = {} as CommentViewObject
    commentViewObject.id = entity.id
    commentViewObject.taskId = entity.taskId
    commentViewObject.content = entity.content
    commentViewObject.attachments = entity.attachments
    commentViewObject.isTopUp = entity.isTopUp
    commentViewObject.createdAt = entity.createdAt
    commentViewObject.avatar = entity.avatar
    commentViewObject.nickname = entity.nickname
    return commentViewObject
}

/**
 * 将创建评论视图对象转换为评论实体
 * @param createCommentViewObject 创建评论视图对象
 * @returns 评论实体
 */
export const createCommentViewObjectToValueObject = (
    createCommentViewObject: CreateCommentViewObject
): CreateCommentValueObject => {
    return new CreateCommentValueObject(
        createCommentViewObject.taskId,
        createCommentViewObject.content,
        createCommentViewObject.attachments || [],
        createCommentViewObject.isTopUp || false
    )
}

/**
 * 将更新评论视图对象转换为更新评论值对象
 * @param updateCommentViewObject 更新评论视图对象
 * @returns 更新评论值对象
 */
export const updateCommentViewObjectToValueObject = (
    updateCommentViewObject: UpdateCommentViewObject
): UpdateCommentValueObject => {
    return new UpdateCommentValueObject(
        updateCommentViewObject.content,
        updateCommentViewObject.isTopUp
    )
}

