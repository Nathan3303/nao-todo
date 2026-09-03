import { NaoSmartListLinkVO } from '@nao-todo/shared'

export type ProjectSmartListProps = {
    links: NaoSmartListLinkVO[]
    draggable?: boolean
}

export type ProjectSmartListEmits = {
    (e: 'open-project-manager'): void
    (e: 'open-project-creator'): void
    (e: 'resort', originalId: string, boundId: string, isBefore: boolean): void
}