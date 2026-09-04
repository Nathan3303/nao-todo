import type { NullableDateString, NullableString, ViewObjectBase } from '@nao-todo/shared/types'

// 项目视图对象
export type ProjectViewObject = ViewObjectBase & {
    // userId: string
    icon: string
    name: string
    description: NullableString
    archivedAt: NullableDateString
    deactivedAt: NullableDateString
    sortId: number
    // -- Others
    isArchived: boolean
    isDeleted: boolean
    createTaskOptions?: { projectId: string }
}

// 创建项目视图对象
export type CreateProjectViewObject = {
    icon: string
    name: string
    description?: NullableString
}

// 更新项目视图对象
export type UpdateProjectViewObject = {
    // id: ProjectViewObject['id']
    icon?: string
    name?: string
    description?: NullableString
    archivedAt?: NullableDateString
    sortId?: number
}