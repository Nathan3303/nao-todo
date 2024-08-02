export type Tag = {
    id: string
    name: string
    color: string
    isDeleted?: boolean
    deletedAt?: Date
    createdAt: Date
    updatedAt: Date
}

export type PageInfo = {
    page: 1
    limit: 10
}

export type TagFilterOptions = Partial<Tag> & Partial<PageInfo>
