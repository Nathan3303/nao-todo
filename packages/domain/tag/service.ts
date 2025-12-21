import type { TagEntity, TagPreferenceEntity } from './entities'
import type { Err, GoAsync, GoLike } from '@nao-todo/types'
import type { TagRepository } from './repositories'

interface TagDomain {
    get(tagId: string): GoAsync<TagEntity>
    create(tagEntity: TagEntity): Promise<GoLike<TagEntity | null>>
    update(tagId: string, tagEntity: TagEntity): Promise<GoLike<string | null>>
    remove(tagId: string): Promise<Err> // like delete
    list(): Promise<GoLike<TagEntity[] | null>>
    getPreference(tagId: string): GoAsync<TagPreferenceEntity>
}

export default (tagRepo: TagRepository): TagDomain => {
    return {
        get: tagRepo.get,
        create: tagRepo.create,
        update: tagRepo.update,
        remove: tagRepo.remove,
        list: tagRepo.list,
        getPreference: tagRepo.getPreference
    }
}
