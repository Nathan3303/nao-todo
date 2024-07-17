import type { Project, TodoCountInfo } from '@/stores'

export type ProjectsMainOverviewProps = {
    countInfo?: TodoCountInfo
    project: Project
}

export type StateOverviewRowProps = {
    icon?: string
    title: string
    count: number
}
