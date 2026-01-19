import type {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceValueObject
} from '@nao-todo/domain/built-in-project/entities'
import type {
    BuiltInProject,
    BuiltInProjectPreference
} from '@nao-todo/infrastructure/built-in/project/types'

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
    vo.projectId = valueObject.projectId || ''
    vo.viewType = valueObject.viewType
    vo.getTasksOptions = valueObject.getTasksOptions
    vo.columns = valueObject.columns
    return vo
}
