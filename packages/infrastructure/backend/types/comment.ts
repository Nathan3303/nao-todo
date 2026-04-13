export type GetCommentRes = {
    id: string
    taskId: string
    content: string
    createdAt: string
    attachments: string[]
    isTopUp: boolean
    commentUser: {
        avatar: string
        nickname: string
    }
}

export type CreateCommentReq = {
    taskId: string
    content: string
}

export type CreateCommentRes = GetCommentRes

export type UpdateCommentReq = {
    content?: string
    attachments?: string[]
    isTopUp?: boolean
}

export type UpdateCommentRes = string

export type ListCommentRes = GetCommentRes[]
