import { Err, GoLike } from '@nao-todo/types'
import { TagEntity } from './entities'

export interface TagRepository {
    get(tagId: string): Promise<GoLike<TagEntity | null>>
    create(tagEntity: TagEntity): Promise<GoLike<TagEntity | null>>
    update(tagId: string, tagEntity: TagEntity): Promise<GoLike<string | null>>
    remove(tagId: string): Promise<Err> // like delete
    list(): Promise<GoLike<TagEntity[] | null>>
}
