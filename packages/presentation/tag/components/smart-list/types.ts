import type { NaoSmartListLinkVO } from '@nao-todo/shared'

// 标签智能列表属性
export type TagSmartListProps = {
    links: NaoSmartListLinkVO[]
    draggable?: boolean
}

// 标签智能列表事件
export type TagSmartListEmits = {
    (e: 'open-tag-manager'): void
    (e: 'open-tag-creator'): void
    (e: 'resort', originalId: string, boundId: string, isBefore: boolean): void
}