import { TagEntity } from './entities'
import type { Err, GoLike } from '@nao-todo/types'
import type { TagRepository } from './repositories'

interface TagDomain {
    get(tagId: string): Promise<GoLike<TagEntity | null>>
    create(tagEntity: TagEntity): Promise<GoLike<TagEntity | null>>
    update(tagId: string, tagEntity: TagEntity): Promise<GoLike<string | null>>
    remove(tagId: string): Promise<Err> // like delete
    list(): Promise<GoLike<TagEntity[] | null>>
}

export default (tagRepo: TagRepository): TagDomain => {
    return {
        get: tagRepo.get,
        create: tagRepo.create,
        update: tagRepo.update,
        remove: tagRepo.remove,
        list: tagRepo.list
    }
}
