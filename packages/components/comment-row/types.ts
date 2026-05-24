export type CommentRowPayload = {
    id: string
    content: string
    createdAt: string
    user: {
        nickname?: string
        avatar?: string
    }
}

export type CommentRowProps = {
    comment: CommentRowPayload
    updater?: (commentId: string, newContent: string) => Promise<void>
    deleter?: (commentId: string) => Promise<void>
}

export type CommentRowEmits = {
    (event: 'delete', commentId: string): void
    (event: 'edit', commentId: string, newContent: string): void
}
