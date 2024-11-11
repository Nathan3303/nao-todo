import type { GetRequestPageOptions } from './common'
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

type CreateTagOptions = CreateTagOptionsRaw

type UpdateTagOptions = UpdateTagOptionsRaw

type GetTagsOptions = UpdateTagOptionsRaw & GetRequestPageOptions

type GetTagOptions = { id?: Tag['id']; name?: Tag['name'] }

type DeleteTagOptions = { id: Tag['id'] }

export type {
    Tag,
    CreateTagOptions,
    UpdateTagOptions,
    GetTagOptions,
    GetTagsOptions,
    DeleteTagOptions
}
