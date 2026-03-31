import type { GoAsync } from '@nao-todo/types'
import { TagEntity, TagPreferenceEntity } from './entities'
import { CreateTagValueObject, UpdateTagValueObject } from './valueobjects'

export interface TagRepository {
    get(tagId: string): GoAsync<TagEntity>
    create(createTagValueObject: CreateTagValueObject): GoAsync<TagEntity>
    update(tagId: string, updateTagValueObject: UpdateTagValueObject): GoAsync<void>
    remove(tagId: string): GoAsync<void> // like delete
    list(): GoAsync<TagEntity[]>
    getPreference(tagId: string): GoAsync<TagPreferenceEntity>
    updatePreference(tagId: string, preferenceEntity: TagPreferenceEntity): GoAsync<string>
}
