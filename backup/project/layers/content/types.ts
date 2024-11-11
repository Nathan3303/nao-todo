import type { Project, ProjectFilterOptions } from '@/stores'

export type ProjectContentProps = {
    title?: string
    subTitle?: string
    filterInfo: ProjectFilterOptions
    projects?: Project[]
}
