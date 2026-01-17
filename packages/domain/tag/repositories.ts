import type { CreateTagVO, Err, GoAsync, UpdateTagVO } from '@nao-todo/types'
import type { TagEntity, TagPreferenceEntity } from './entities'

export interface TagRepository {
    get(tagId: string): GoAsync<TagEntity>
    create(createVO: CreateTagVO): GoAsync<TagEntity | null>
    update(tagId: string, updateVO: UpdateTagVO): GoAsync<void>
    remove(tagId: string): Promise<Err> // like delete
    list(): GoAsync<TagEntity[]>
    getPreference(tagId: string): GoAsync<TagPreferenceEntity>
    updatePreference(tagId: string, preferenceEntity: TagPreferenceEntity): GoAsync<string>
}
