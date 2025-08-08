export type NaoSmartListLinkVO = {
    id: string
    title: string
    icon?: string
    route: { name: string; params: Record<string, any> } | string
    payload?: Record<string, any>
}

export type NaoSmartListProps = {
    collapseItemName?: string
    name?: string
    count?: number
    manageBtnTooltip?: string
    createBtnTooltip?: string
    emptyText?: string
    links?: NaoSmartListLinkVO[]
}

export type NaoSmartListEmits = {
    (e: 'manage'): void
    (e: 'create'): void
}
