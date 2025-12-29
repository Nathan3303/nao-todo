import type { CommentEntity } from './entities'
import type { GoAsync } from '@nao-todo/types'
import type { UpdateCommentValueObject } from './valueobjects'

export interface CommentRepository {
    get(commentId: string): GoAsync<CommentEntity>
    create(commentEntity: CommentEntity): GoAsync<CommentEntity>
    update(commentId: string, updateValueObject: UpdateCommentValueObject): GoAsync<string>
    remove(commentId: string): GoAsync<void>
    list(taskId: string): GoAsync<CommentEntity[]>
}
