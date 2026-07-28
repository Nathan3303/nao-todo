import type {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceEntity
} from '@nao-todo/domain/built-in-project'
import type { BuiltInProjectPreferenceRes, BuiltInProjectRes } from './types'

/**
 * 内建清单响应转换为实体
 * @param bipRes 内建清单响应
 * @returns 内建清单实体
 */
export const bipRes2bipEntity = (bipRes: BuiltInProjectRes): BuiltInProjectEntity => {
    const bipe = {} as BuiltInProjectEntity
    bipe.id = bipRes.id
    bipe.icon = bipRes.icon
    bipe.name = bipRes.name
    bipe.description = bipRes.description
    bipe.createTaskOptions = bipRes.createTaskOptions
    return bipe
}

/**
 * 内建清单偏好响应转换为视图对象
 * @param bippRes 内建清单偏好响应
 * @returns 内建清单偏好视图对象
 */
export const bippRes2bippVO = (
    bippRes: BuiltInProjectPreferenceRes
): BuiltInProjectPreferenceEntity => {
    const bippvo = {} as BuiltInProjectPreferenceEntity
    bippvo.projectId = bippRes.projectId
    bippvo.viewType = bippRes.viewType
    bippvo.getTasksOptions = bippRes.getTasksOptions
    bippvo.columns = bippRes.columns
    return bippvo
}

/**
 * 内建清单偏好视图对象转换为响应
 * @param bippvo 内建清单偏好视图对象
 * @returns 内建清单偏好响应
 */
export const bippVO2bippRes = (
    bippvo: BuiltInProjectPreferenceEntity
): BuiltInProjectPreferenceRes => {
    const bipp = {} as BuiltInProjectPreferenceRes
    bipp.projectId = bippvo.projectId || ''
    bipp.viewType = bippvo.viewType
    bipp.getTasksOptions = bippvo.getTasksOptions
    bipp.columns = bippvo.columns
    return bipp
}