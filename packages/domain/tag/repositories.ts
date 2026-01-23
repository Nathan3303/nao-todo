import type { CreateTag, GoAsync, UpdateTag } from '@nao-todo/types'
import type { TagEntity, TagPreferenceEntity } from './entities'

export interface TagRepository {
    get(tagId: string): GoAsync<TagEntity>
    create(createTag: CreateTag): GoAsync<TagEntity>
    update(tagId: string, updateTag: UpdateTag): GoAsync<void>
    remove(tagId: string): GoAsync<void> // like delete
    list(): GoAsync<TagEntity[]>
    getPreference(tagId: string): GoAsync<TagPreferenceEntity>
    updatePreference(tagId: string, preferenceEntity: TagPreferenceEntity): GoAsync<string>
}
