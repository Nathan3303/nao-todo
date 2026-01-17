import type { TagEntity, TagPreferenceEntity } from './entities'
import type { CreateTagVO, Err, GoAsync, UpdateTagVO } from '@nao-todo/types'
import type { TagRepository } from './repositories'

interface TagDomain {
    get(tagId: string): GoAsync<TagEntity>
    create(createVO: CreateTagVO): GoAsync<TagEntity | null>
    update(tagId: string, updateVO: UpdateTagVO): GoAsync<void>
    remove(tagId: string): Promise<Err> // like delete
    list(): GoAsync<TagEntity[]>
    getPreference(tagId: string): GoAsync<TagPreferenceEntity>
    updatePreference(tagId: string, preferenceEntity: TagPreferenceEntity): GoAsync<string>
}

export default (tagRepo: TagRepository): TagDomain => {
    return {
        get: tagRepo.get,
        create: tagRepo.create,
        update: tagRepo.update,
        remove: tagRepo.remove,
        list: tagRepo.list,
        getPreference: tagRepo.getPreference,
        updatePreference: tagRepo.updatePreference
    }
}
