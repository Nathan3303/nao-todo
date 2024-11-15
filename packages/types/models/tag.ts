import type { GetRequestPageOptions } from '../axios/common'
import type { User } from './user'

type Tag = {
    _id?: string
    id: string
    userId: User['id']
    name: string
    color: string
    description: string
    isDeleted: boolean
    deletedAt: Date | null
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
    CreateTagOptions,
    UpdateTagOptions,
    GetTagOptions,
    GetTagsOptionsRaw,
    UpdateTagOptionsRaw,
    GetTagsOptions,
    DeleteTagOptions
}
