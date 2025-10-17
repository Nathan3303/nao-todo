import type { GetRequestPageOptions } from '../axios/common'
import type { User } from './user'
import type { TodoColumnOptions, GetTodosOptions } from './todo'

type TagPreference = {
    viewType: string
    getTodosOptions: GetTodosOptions
    columns: TodoColumnOptions
}

type Tag = {
    _id?: string
    id: string
    userId: User['id']
    name: string
    color: string
    description: string
    isDeleted: boolean
    deletedAt: Date | null
    preference: TagPreference
}

type CreateTagOptionsRaw = {
    name: string
    color: string
    description: string
}

type UpdateTagOptionsRaw = {
    name?: string
    color?: string
    description?: string
    isDeleted?: boolean
    deletedAt?: Date | null
}

type GetTagsOptionsRaw = UpdateTagOptionsRaw

type CreateTagOptions = CreateTagOptionsRaw

type UpdateTagOptions = UpdateTagOptionsRaw

type GetTagsOptions = GetTagsOptionsRaw & GetRequestPageOptions

type GetTagOptions = { id?: Tag['id']; name?: Tag['name'] }

type DeleteTagOptions = { id: Tag['id'] }

export type {
    Tag,
    TagPreference,
    CreateTagOptions,
    UpdateTagOptions,
    GetTagOptions,
    GetTagsOptionsRaw,
    UpdateTagOptionsRaw,
    GetTagsOptions,
    DeleteTagOptions
}
