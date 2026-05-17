export type CommentViewObject = {
    id: string
    // taskId: string
    content: string
    attachments: string[]
    isTopUp: boolean
    createdAt: string
    user: CommentUserViewObject
}

export type CommentUserViewObject = {
    avatar: string
    nickname: string
}

export type UpdateCommentViewObject = {
    content?: string
    isTopUp?: boolean
}

export type CreateCommentViewObject = {
    taskId: string
    content: string
    attachments?: string[]
    isTopUp?: boolean
}
