export type Project = {
    id: string
    userId: string
    owner?: object
    title: string
    description: string
    state: 0 | 1 | 2
    isArchived: boolean
    isDeleted: boolean
    isFinished: boolean
    isFavorite: boolean
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    finishedAt: Date | null
    archivedAt: Date | null
}

export type CreateProjectPayload = {
    title: Project['title']
    description?: Project['description']
}