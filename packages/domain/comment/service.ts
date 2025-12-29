import type { CommentEntity } from './entities'
import type { GoAsync } from '@nao-todo/types'
import type { CommentRepository } from './repositories'
import type { UpdateCommentValueObject } from './valueobjects'

interface CommentDomain {
    get(commentId: string): GoAsync<CommentEntity>
    create(commentEntity: CommentEntity): GoAsync<CommentEntity>
    update(commentId: string, updateValueObject: UpdateCommentValueObject): GoAsync<string>
    remove(commentId: string): GoAsync<void>
    list(taskId: string): GoAsync<CommentEntity[]>
}

export default (commentRepo: CommentRepository): CommentDomain => {
    return {
        get: commentRepo.get,
        create: commentRepo.create,
        update: commentRepo.update,
        remove: commentRepo.remove,
        list: commentRepo.list
    }
}
