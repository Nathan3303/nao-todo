import type { Err, GoAsync, GoLike } from '@nao-todo/types'
import type { TagEntity, TagPreferenceEntity } from './entities'

export interface TagRepository {
    get(tagId: string): GoAsync<TagEntity>
    create(tagEntity: TagEntity): Promise<GoLike<TagEntity | null>>
    update(tagId: string, tagEntity: TagEntity): Promise<GoLike<string | null>>
    remove(tagId: string): Promise<Err> // like delete
    list(): Promise<GoLike<TagEntity[] | null>>
    getPreference(tagId: string): GoAsync<TagPreferenceEntity>
}
