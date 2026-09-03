export type TagNodeProps = {
    tag: { id: string; name: string; color: string }
    deletable?: boolean
    readonly?: boolean
}

export type TagNodeEmits = {
    (event: 'delete', id: string): void
}