import type { NullableDateString, NullableString } from '../../types'

// 项目卡片所需的最小项目结构（避免 shared 反向依赖 domain 包）
export type ProjectCardVO = {
    id: string
    icon: string
    name: string
    description: NullableString
    deactivedAt: NullableDateString
    createdAt: string
    isArchived: boolean
    isDeleted: boolean
    /** 归档时间（归档面板展示用） */
    archivedAt?: NullableDateString
    /** 归档清单的「已归档且未删除」任务数（归档面板展示用，DP-3） */
    archivedTaskCount?: number
}

export type ProjectCardProps = {
    project: ProjectCardVO
    allowRoute?: boolean
}

export type ProjectCardEmits = {
    (event: 'click', project: ProjectCardVO): void
    (event: 'unarchiveProject', projectId: ProjectCardVO['id']): void
}