export type Comment = {
    id: string
    taskId: string
    content: string
    attachments?: string[]
    isTopUp: boolean
    createdAt: string
    user: CommentUser
}

export type CommentUser = {
    avatar: string
    nickname: string
}

export type UpdateComment = {
    content?: string
    isTopUp?: boolean
}

export type CreateComment = {
    taskId: string
    content: string
    attachments?: string[]
    isTopUp?: boolean
}