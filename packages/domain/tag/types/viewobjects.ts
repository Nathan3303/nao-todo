import type {
    NullableString,
    ViewObjectBase,
    GetTasksOptions,
    TaskColumnOptions
} from '@nao-todo/shared'

// 标签视图对象
export type TagViewObject = ViewObjectBase & {
    sortId: number
    icon: NullableString
    name: string
    description: NullableString
    color: string
}

// 创建标签视图对象
export type CreateTagViewObject = {
    name: TagViewObject['name']
    description?: TagViewObject['description']
    color: TagViewObject['color']
    icon?: TagViewObject['icon']
}

// 更新标签视图对象
export type UpdateTagViewObject = {
    // id: TagViewObject['id']
    sortId?: TagViewObject['sortId']
    name?: TagViewObject['name']
    description?: TagViewObject['description']
    color?: TagViewObject['color']
}

// 标签偏好视图对象
export type TagPreferenceViewObject = ViewObjectBase & {
    tagId: TagViewObject['id']
    viewType: string
    getTasksOptions: Partial<GetTasksOptions>
    columns: TaskColumnOptions
}
