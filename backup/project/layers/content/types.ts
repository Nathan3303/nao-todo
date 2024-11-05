import type { Project, ProjectFilterOptions } from '@nao-todo/stores'

export type ProjectContentProps = {
    title?: string
    subTitle?: string
    filterInfo: ProjectFilterOptions
    projects?: Project[]
}
