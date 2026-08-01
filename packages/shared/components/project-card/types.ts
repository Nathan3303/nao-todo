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
}

export type ProjectCardProps = {
    project: ProjectCardVO
    allowRoute?: boolean
}

export type ProjectCardEmits = {
    (event: 'click', project: ProjectCardVO): void
    (event: 'unarchiveProject', projectId: ProjectCardVO['id']): void
}