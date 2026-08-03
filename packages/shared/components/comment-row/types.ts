export type CommentRowPayload = {
    id: string
    content: string
    createdAt: string
    nickname: string
    avatar: string
}

export type CommentRowProps = {
    comment: CommentRowPayload
    /** 当前登录 JWT，用于本地头像携带凭证 */
    token?: string
    updater?: (commentId: string, newContent: string) => void
    deleter?: (commentId: string) => void
}

export type CommentRowEmits = {
    (event: 'delete', commentId: string): void
    (event: 'edit', commentId: string, newContent: string): void
}