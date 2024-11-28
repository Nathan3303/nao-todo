import type { User } from './user'
import type { Todo } from './todo'

type Comment = {
    _id?: string
    id: string
    userId: User['id']
    todoId: Todo['id']
    content: string
    attachments: string[]
    isTopUp: boolean
    createdAt: string
    updatedAt: string
    // extend fields
    user: Partial<User>
}

type CreateCommentOptionsRaw = {
    todoId: Todo['id']
    content: string
}

type UpdateCommentOptionsRaw = {
    content?: string
    isTopUp?: boolean
}

type GetCommentsOptionsRaw = {
    todoId?: Todo['id']
}

type CreateCommentOptions = CreateCommentOptionsRaw

type UpdateCommentOptions = UpdateCommentOptionsRaw

type GetCommentsOptions = GetCommentsOptionsRaw

type DeleteCommentOptions = { id: Comment['id'] }

export type {
    Comment,
    CreateCommentOptions,
    UpdateCommentOptionsRaw,
    UpdateCommentOptions,
    GetCommentsOptions,
    DeleteCommentOptions
}
