export type CommentVO = {
    id: string
    taskId: string
    content: string
    attachments?: string[]
    isTopUp: boolean
    createdAt: string
    user: CommentUserVO
}

export type CommentUserVO = {
    avatar: string
    nickname: string
}

export type UpdateCommentVO = {
    content?: string
    isTopUp?: boolean
}

export type CreateCommentVO = {
    taskId: string
    content: string
    attachments?: string[]
    isTopUp?: boolean
}