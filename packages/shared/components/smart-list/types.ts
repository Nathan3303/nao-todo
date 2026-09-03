export type NaoSmartListLinkVO = {
    id: string
    title: string
    icon?: string
    route: { name: string; params: Record<string, unknown> } | string
    payload?: Record<string, unknown>
}

export type NaoSmartListProps = {
    collapseItemName?: string
    name?: string
    count?: number
    manageBtnTooltip?: string
    createBtnTooltip?: string
    emptyText?: string
    links?: NaoSmartListLinkVO[]
    draggable?: boolean
}

export type NaoSmartListEmits = {
    (e: 'manage'): void
    (e: 'create'): void
    (e: 'dragstart', event: DragEvent): void
    (e: 'dragover', event: DragEvent): void
    (e: 'dragleave', event: DragEvent): void
    (e: 'dragend', event: DragEvent): void
    (e: 'drop', event: DragEvent): void
}