import type { Project, Tag } from '@/stores'

export type ContentHeaderProps = {
    title?: string
    subTitle?: string
    project?: Project | null
    tag?: Tag
}
