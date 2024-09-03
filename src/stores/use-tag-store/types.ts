import type { User } from "../use-user-store"

export type Tag = {
    id: string
    userId: User['id']
    name: string
    color: string
    isDeleted?: boolean
    deletedAt?: string
    createdAt: string
    updatedAt: string
}

export type PageInfo = {
    page: 1
    limit: 10
}

export type TagFilterOptions = Partial<Tag> & Partial<PageInfo>
