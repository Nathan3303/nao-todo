import type { Project, TodoCountInfo } from '@nao-todo/stores'

export type ProjectsMainOverviewProps = {
    countInfo?: TodoCountInfo
    project: Project
}

export type StateOverviewRowProps = {
    icon?: string
    title: string
    count?: number
}
