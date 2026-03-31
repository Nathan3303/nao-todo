import type { ModelBase } from './base'

export type Comment = ModelBase & {
    userId: string
    taskId: string
    content: string
    attachment: string[]
    isTopUp: boolean
    commentUser: CommentUser
}

export type CommentUser = ModelBase & {
    commentId: string
    avatar: string
    nickname: string
}
