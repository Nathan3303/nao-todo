import type { BuiltInProjectPreferenceViewObject, BuiltInProjectViewObject } from './viewobjects'

/**
 * 内置项目存储接口
 * @description 内置项目存储接口，用于表示内置项目的业务逻辑和数据存储。
 */
export interface BuiltInProjectStore {
    /**
     * 获取内置项目偏好
     * @description 获取内置项目的偏好设置。
     * @returns 内置项目的偏好设置。
     */
    getBuiltInProjectPreference(): BuiltInProjectPreferenceViewObject | undefined

    /**
     * 设置内置项目
     * @description 设置内置项目的偏好设置。
     * @param preference 内置项目的偏好设置。
     */
    setBuiltInProjects(builtInProjects: BuiltInProjectViewObject[]): void

    /**
     * 设置内置项目偏好
     * @description 设置内置项目的偏好设置。
     * @param preference 内置项目的偏好设置。
     */
    setBuiltInProjectPreference(preference: BuiltInProjectPreferenceViewObject): void
}

