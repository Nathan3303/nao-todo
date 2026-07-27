import type {
    NullableString,
    ViewObjectBase,
    GetTasksOptions,
    TaskColumnOptions
} from '@nao-todo/shared'

// 标签存储接口
export type TagStore = {
    tags: TagViewObject[]
    setTags: (tags: TagViewObject[]) => void
    addTag: (tag: TagViewObject) => void
    getTag: (id: string) => TagViewObject | undefined
    updateTag: (id: string, update: Partial<UpdateTagViewObject>) => void
    updateTags: (tags: TagViewObject[]) => void
    getAllTags: () => TagViewObject[]
    deleteTag: (id: string) => void
    tagPreference: TagPreferenceViewObject | undefined
    setTagPreference: (preference: TagPreferenceViewObject) => void
    getTagPreference: () => TagPreferenceViewObject | undefined
    updatePreferenceColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updatePreferenceGetTasksOptions: <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => void
    getPreferenceGetTasksOption: <T extends keyof GetTasksOptions>(key: T) => GetTasksOptions[T]
    getPreferenceGetTasksOptions: () => GetTasksOptions
}

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