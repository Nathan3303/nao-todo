import { CommentEntity } from './entities'
import type { Err, GoLike } from '@nao-todo/types'
import type { CommentRepository } from './repositories'

interface CommentDomain {
    get(commentId: string): Promise<GoLike<CommentEntity | null>>
    create(commentEntity: CommentEntity): Promise<GoLike<CommentEntity | null>>
    update(commentId: string, commentEntity: CommentEntity): Promise<GoLike<string | null>>
    remove(commentId: string): Promise<Err> // like delete
    list(): Promise<GoLike<CommentEntity[] | null>>
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
