import type {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceValueObject
} from '@nao-todo/domain/built-in-project/entities'
import type {
    BuiltInProject,
    BuiltInProjectPreference,
    GetTasksOptions,
    TaskColumnOptions
} from '@nao-todo/types'
import jsonParse from '@nao-todo/infrastructure/utils/json-parse'

/**
 * 内建项目实体转换为视图对象
 * @param entity 内建项目实体
 * @returns 内建项目视图对象
 */
export const builtInProjectEntity2ViewObject = (entity: BuiltInProjectEntity): BuiltInProject => {
    const vo = {} as BuiltInProject
    vo.id = entity.id
    vo.name = entity.name
    vo.description = entity.description
    vo.icon = entity.icon
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
): BuiltInProject[] => {
    return entities.map(builtInProjectEntity2ViewObject)
}

/**
 * 内建项目偏好值对象转换为视图对象
 * @param valueObject 内建项目偏好值对象
 * @returns 内建项目偏好视图对象
 */
export const builtInProjectPreferenceValueObject2ViewObject = (
    valueObject: BuiltInProjectPreferenceValueObject
): BuiltInProjectPreference => {
    const vo = {} as BuiltInProjectPreference
    vo.projectId = valueObject.projectId
    vo.viewType = valueObject.viewType
    const [getTasksOptions, err] = jsonParse(valueObject.getTasksOptions)
    if (err !== null) {
        vo.getTasksOptions = {} as GetTasksOptions
    } else {
        vo.getTasksOptions = getTasksOptions as GetTasksOptions
    }
    const [columns, err2] = jsonParse(valueObject.columns)
    if (err2 !== null) {
        vo.columns = {} as TaskColumnOptions
    } else {
        vo.columns = columns as TaskColumnOptions
    }
    return vo
}

export const builtInProjectPreferenceViewObject2ValueObject = (
    viewObject: BuiltInProjectPreference
): BuiltInProjectPreferenceValueObject => {
    const vo = {} as BuiltInProjectPreferenceValueObject
    vo.projectId = viewObject.projectId
    vo.viewType = viewObject.viewType
    vo.getTasksOptions = JSON.stringify(viewObject.getTasksOptions)
    vo.columns = JSON.stringify(viewObject.columns)
    return vo
}
