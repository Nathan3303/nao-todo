import {
    defaultColumns,
    JsonStringValueObject,
    type GetTasksOptions,
    type TaskColumnOptions
} from '@nao-todo/shared'
import {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceEntity
} from '@nao-todo/domain-built-in-project'
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
    vo.userId = entity.userId
    vo.viewType = entity.viewType
    vo.getTasksOptions = entity.getTasksOptions.valueOr({}) as GetTasksOptions
    vo.columns = entity.columns.valueOr(defaultColumns) as TaskColumnOptions
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
    return new BuiltInProjectPreferenceEntity(
        '',
        viewObject.userId,
        viewObject.projectId,
        viewObject.viewType,
        JsonStringValueObject.CreateByObject(viewObject.getTasksOptions),
        JsonStringValueObject.CreateByObject(viewObject.columns)
    )
}