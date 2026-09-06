import type { NullableString, ViewObjectBase } from '@nao-todo/shared/types'

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