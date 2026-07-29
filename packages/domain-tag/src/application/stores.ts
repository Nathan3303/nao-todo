import { GetTasksOptions, TaskColumnOptions } from '@nao-todo/shared'
import { TagViewObject, UpdateTagViewObject } from './viewobjects/tag'
import { TagPreferenceViewObject } from './viewobjects/tag-preference'

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