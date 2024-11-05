import type { Project, Tag } from '@nao-todo/stores'

export type ContentHeaderProps = {
    title?: string
    subTitle?: string
    project?: Project | null
    tag?: Tag
}
