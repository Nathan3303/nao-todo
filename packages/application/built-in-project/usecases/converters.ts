import { defaultColumns, jsonParse, type GetTasksOptions } from '@nao-todo/shared'
import { BuiltInProjectEntity, BuiltInProjectPreferenceEntity } from '@nao-todo/domain/built-in-project/entities'
import type { BuiltInProjectPreferenceViewObject, BuiltInProjectViewObject } from '../viewobjects'

/**
 * 内建项目实体转换为视图对象
 * @param entity 内建项目实体
 * @returns 内建项目视图对象
 */
export const builtInProjectEntity2ViewObject = (
    entity: BuiltInProjectEntity
): BuiltInProjectViewObject => {
    const vo = {} as BuiltInProjectViewObject
    vo.id = entity.id
    vo.name = entity.name
    vo.icon = entity.icon
    vo.description = entity.description
    vo.createTaskOptions = entity.createTaskOptions
    return vo
}

/**
 * 内建项目实体列表转换为视图对象列表
 * @param entities 内建项目实体列表
 * @returns 内建项目视图对象列表
 */
export const builtInProjectEntities2ViewObjects = (
    entities: BuiltInProjectEntity[]
): BuiltInProjectViewObject[] => {
    return entities.map(builtInProjectEntity2ViewObject)
}

/**
 * 内建项目偏好实体转换为视图对象
 * @param entity 内建项目偏好实体
 * @returns 内建项目偏好视图对象
 */
export const builtInProjectPreferenceEntity2ViewObject = (
    entity: BuiltInProjectPreferenceEntity
): BuiltInProjectPreferenceViewObject => {
    const vo = {} as BuiltInProjectPreferenceViewObject
    vo.projectId = entity.projectId
    vo.viewType = entity.viewType
    const [getTasksOptions, err] = jsonParse(entity.getTasksOptions)
    if (err !== null) {
        vo.getTasksOptions = {} as GetTasksOptions
    } else {
        vo.getTasksOptions = getTasksOptions as GetTasksOptions
    }
    const [columns, err2] = jsonParse(entity.columns)
    if (err2 !== null) {
        vo.columns = defaultColumns
    } else {
        vo.columns = { ...defaultColumns, ...columns }
    }
    return vo
}

/**
 * 内建项目偏好视图对象转换为实体
 * @param viewObject 内建项目偏好视图对象
 * @returns 内建项目偏好实体
 */
export const builtInProjectPreferenceViewObject2Entity = (
    viewObject: BuiltInProjectPreferenceViewObject
): BuiltInProjectPreferenceEntity => {
    const entity = {} as BuiltInProjectPreferenceEntity
    entity.projectId = viewObject.projectId
    entity.viewType = viewObject.viewType
    entity.getTasksOptions = JSON.stringify(viewObject.getTasksOptions)
    entity.columns = JSON.stringify(viewObject.columns)
    return entity
}
