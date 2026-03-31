import { CommentEntity } from './entities'
import { CreateCommentValueObject, UpdateCommentValueObject } from './valueobjects'
import type { GoAsync } from '@nao-todo/types'

export interface CommentRepository {
    get(commentId: string): GoAsync<CommentEntity>
    create(createCommentValueObject: CreateCommentValueObject): GoAsync<CommentEntity>
    update(commentId: string, updateCommentValueObject: UpdateCommentValueObject): GoAsync<string>
    remove(commentId: string): GoAsync<void>
    list(taskId: string): GoAsync<CommentEntity[]>
}
