import type { CommentUserValueObject } from './valueobjects'

export type CommentEntity = {
    id: string
    taskId: string
    content: string
    createdAt: string
    attachments: string[]
    isTopUp: boolean
    commentUser: CommentUserValueObject
}

export const makeCommentEntity = (): CommentEntity => {
    return {
        id: '',
        taskId: '',
        content: '',
        createdAt: '',
        attachments: [],
        isTopUp: false,
        commentUser: {
            avatar: '',
            nickname: ''
        }
    }
}
