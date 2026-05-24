export type CommentCreatorProps = {
    handler?: (content: string) => Promise<boolean>
}

export type CommentCreatorEmits = {
    (e: 'submit', content: string): void
    (e: 'cancel'): void
}
