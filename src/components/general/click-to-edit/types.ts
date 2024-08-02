export type ClickToEditProps = {
    text?: string
    placeholder?: string
    title?: string
    preventDefault?: boolean
    size?: string
    color?: string
    weight?: string
    emptyholder?: string
}

export type ClickToEditEmits = {
    (event: 'edit', payload: string): void
}
