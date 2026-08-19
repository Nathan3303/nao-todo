export type TagCardVO = {
    id: string
    name: string
    color: string
    description: string | null
}

export type TagCardProps = {
    tag: TagCardVO
}