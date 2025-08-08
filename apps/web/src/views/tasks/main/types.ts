import type { Project, Tag } from '@nao-todo/types'

export type TasksViewContentProps = {
    title?: string
    subTitle?: string
    project?: Project | null
    tag?: Tag
}
