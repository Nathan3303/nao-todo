import type { CreateTagVO, Err, GoAsync, GoLike, UpdateTagVO } from '@nao-todo/types'
import type { TagEntity, TagPreferenceEntity } from './entities'

export interface TagRepository {
    get(tagId: string): GoAsync<TagEntity>
    create(createVO: CreateTagVO): GoAsync<TagEntity | null>
    update(tagId: string, updateVO: UpdateTagVO): GoAsync<void>
    remove(tagId: string): Promise<Err> // like delete
    list(): Promise<GoLike<TagEntity[] | null>>
    getPreference(tagId: string): GoAsync<TagPreferenceEntity>
}
