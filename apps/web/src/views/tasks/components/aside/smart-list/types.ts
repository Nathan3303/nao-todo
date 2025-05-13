export type SmartListLinkVO = {
    id: string
    title: string
    icon?: string
    route: { name: string; params: Record<string, any> } | string
    payload?: Record<string, any>
}

export type SmartListProps = {
    collapseItemName?: string
    name?: string
    count?: number
    manageBtnTooltip?: string
    createBtnTooltip?: string
    emptyText?: string
    links?: SmartListLinkVO[]
}

export type SmartListEmits = {
    (e: 'manage'): void
    (e: 'create'): void
}
