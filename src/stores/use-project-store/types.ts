export type Project = {
    _id?: string
    id: string
    name: string
    description?: string
    owner?: string
    createAt: string
    updateAt: string
}

export type CreateProjectPayload = {
    name: Project['name']
    description?: Project['description']
}
