export type InnerDropdownProps = {
    title?: string;
    icon?: string;
}

export type InnerDropdownEmits = {
    (event: 'execute', payload: string): void
}

export type InnerDropdownOptionProps = {
    color?: string
    icon?: string
    title: string
    checked?: boolean
}