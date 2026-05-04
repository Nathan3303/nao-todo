import type { ModelBase } from './base'

export type CommentModel = ModelBase & {
    userId: string
    taskId: string
    content: string
    attachment: string[]
    isTopUp: boolean
    commentUser: CommentUserModel
}

export type CommentUserModel = ModelBase & {
    commentId: string
    avatar: string
    nickname: string
}
