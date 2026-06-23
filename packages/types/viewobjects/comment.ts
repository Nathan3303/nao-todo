export type CommentViewObject = {
    id: string
    taskId: string
    content: string
    attachments: string[]
    isTopUp: boolean
    createdAt: string
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

