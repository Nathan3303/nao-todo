import type { Go } from '../../types'

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
    /** 更新回调：返回 GoError（null 表示成功），供保存失败时保留编辑框 */
    updater?: (commentId: string, newContent: string) => Go<void> | void | Promise<Go<void>>
    deleter?: (commentId: string) => void
}

export type CommentRowEmits = {
    (event: 'delete', commentId: string): void
    (event: 'edit', commentId: string, newContent: string): void
}