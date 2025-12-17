import { Err, GoLike } from '@nao-todo/types'
import { CommentEntity } from './entities'

export interface CommentRepository {
    get(commentId: string): Promise<GoLike<CommentEntity | null>>
    create(commentEntity: CommentEntity): Promise<GoLike<CommentEntity | null>>
    update(commentId: string, commentEntity: CommentEntity): Promise<GoLike<string | null>>
    remove(commentId: string): Promise<Err> // like delete
    list(): Promise<GoLike<CommentEntity[] | null>>
}
