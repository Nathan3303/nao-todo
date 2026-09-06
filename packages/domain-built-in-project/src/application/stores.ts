import type { GetTasksOptions, TaskColumnOptions } from '@nao-todo/shared/constants/task'
import type {
    BuiltInProjectPreferenceViewObject,
    BuiltInProjectViewObject
} from './viewobjects/builtins'

// 内建项目存储接口
export type BuiltInProjectStore = {
    setBuiltInProjects: (projects: BuiltInProjectViewObject[]) => void
    setBuiltInProjectPreference: (preference: BuiltInProjectPreferenceViewObject) => void
    getBuiltInProjectPreference: () => BuiltInProjectPreferenceViewObject | undefined
    updatePreferenceColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updatePreferenceGetTasksOptions: <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => void
    getPreferenceGetTasksOption: <T extends keyof GetTasksOptions>(key: T) => GetTasksOptions[T]
    getPreferenceGetTasksOptions: () => GetTasksOptions
}