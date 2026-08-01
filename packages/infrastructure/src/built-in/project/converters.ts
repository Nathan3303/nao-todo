import type { BuiltInProjectEntity } from '@nao-todo/domain-built-in-project'
import { BuiltInProjectPreferenceEntity } from '@nao-todo/domain-built-in-project'
import { JsonStringValueObject } from '@nao-todo/shared'
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
    bipe.createTaskOptions = bipRes.createTaskOptions as never
    return bipe
}

/**
 * 内建清单偏好响应转换为实体
 * @param bippRes 内建清单偏好响应
 * @returns 内建清单偏好实体
 */
export const bippRes2bippVO = (
    bippRes: BuiltInProjectPreferenceRes
): BuiltInProjectPreferenceEntity => {
    return new BuiltInProjectPreferenceEntity(
        '',
        bippRes.userId,
        bippRes.projectId,
        bippRes.viewType,
        JsonStringValueObject.CreateByJsonString(bippRes.getTasksOptions),
        JsonStringValueObject.CreateByJsonString(bippRes.columns)
    )
}

/**
 * 内建清单偏好实体转换为响应
 * @param bippvo 内建清单偏好实体
 * @returns 内建清单偏好响应
 */
export const bippVO2bippRes = (
    bippvo: BuiltInProjectPreferenceEntity
): BuiltInProjectPreferenceRes => {
    const bipp = {} as BuiltInProjectPreferenceRes
    bipp.projectId = bippvo.projectId || ''
    bipp.userId = bippvo.userId
    bipp.viewType = bippvo.viewType
    bipp.getTasksOptions = bippvo.getTasksOptions.unmarshal()
    bipp.columns = bippvo.columns.unmarshal()
    return bipp
}