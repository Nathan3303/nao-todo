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
    page: number
    limit: number
}

export type TagFilterOptions = Partial<Tag> & Partial<PageInfo>
