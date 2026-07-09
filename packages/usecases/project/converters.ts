import {
    CreateProjectValueObject,
    ProjectEntity,
    ProjectPreferenceEntity,
    UpdateProjectValueObject
} from '@nao-todo/domain/project'
import type {
    CreateProjectViewObject,
    ProjectPreferenceViewObject,
    ProjectViewObject,
    UpdateProjectViewObject
} from './viewobjects'
import dayjs from 'dayjs'
import jsonParse from '@nao-todo/infrastructure/utils/json-parse'
import { defaultColumns } from '@nao-todo/infrastructure/consts/tasks'

/**
 * 将项目实体转换为项目视图对象
 * @param projectEntity 项目实体
 * @returns 项目视图对象
 */
export const projectEntityToViewObject = (projectEntity: ProjectEntity): ProjectViewObject => {
    return {
        id: projectEntity.id,
        createdAt: projectEntity.createdAt,
        updatedAt: projectEntity.updatedAt,
        deletedAt: projectEntity.deletedAt,
        icon: projectEntity.icon || 'more2',
        name: projectEntity.name,
        description: projectEntity.description,
        archivedAt: projectEntity.archivedAt,
        deactivedAt: projectEntity.deactivedAt,
        sortId: projectEntity.sortId,
        isArchived: dayjs(projectEntity.archivedAt).isValid(),
        isDeleted: dayjs(projectEntity.deactivedAt).isValid(),
        createTaskOptions: { projectId: projectEntity.id }
    }
}

/**
 * 将项目实体数组转换为项目视图对象数组
 * @param projectEntities 项目实体数组
 * @returns 项目视图对象数组
 */
export const projectEntitiesToViewObjects = (
    projectEntities: ProjectEntity[]
): ProjectViewObject[] => {
    return projectEntities.map(projectEntityToViewObject)
}

/**
 * 将项目偏好实体转换为项目偏好视图对象
 * @param entity 项目偏好实体
 * @returns 项目偏好视图对象
 */
export const projectPreferenceEntityToViewObject = (
    entity: ProjectPreferenceEntity
): ProjectPreferenceViewObject => {
    const [getTasksOptions, err1] = jsonParse(entity.getTasksOptions)
    const [columns, err2] = jsonParse(entity.columns)
    const vo = {} as ProjectPreferenceViewObject
    // vo.id = entity.id
    vo.projectId = entity.projectId
    vo.viewType = entity.viewType
    vo.getTasksOptions = err1 !== null ? { limit: 20 } : getTasksOptions
    vo.columns = err2 !== null ? defaultColumns : { ...defaultColumns, ...columns }
    return vo
}

/**
 * 将项目偏好视图对象转换为项目偏好实体
 * @param projectPreferenceViewObject 项目偏好视图对象
 * @returns 项目偏好实体
 */
export const projectPreferenceViewObjectToEntity = (
    projectPreferenceViewObject: ProjectPreferenceViewObject
): ProjectPreferenceEntity => {
    return new ProjectPreferenceEntity(
        projectPreferenceViewObject.id,
        projectPreferenceViewObject.createdAt,
        projectPreferenceViewObject.updatedAt,
        projectPreferenceViewObject.deletedAt,
        projectPreferenceViewObject.projectId,
        projectPreferenceViewObject.viewType,
        JSON.stringify(projectPreferenceViewObject.getTasksOptions),
        JSON.stringify(projectPreferenceViewObject.columns)
    )
}

/**
 * 将创建项目视图对象转换为创建项目值对象
 * @param createProjectViewObject 创建项目视图对象
 * @returns 创建项目值对象
 */
export const createProjectViewObjectToValueObject = (
    createProjectViewObject: CreateProjectViewObject
): CreateProjectValueObject => {
    return new CreateProjectValueObject(
        createProjectViewObject.name,
        createProjectViewObject.icon || 'more2',
        createProjectViewObject.description || ''
    )
}

/**
 * 将更新项目视图对象转换为更新项目值对象
 * @param projectId 项目ID
 * @param updateProjectViewObject 更新项目视图对象
 * @returns 更新项目值对象
 */
export const updateProjectViewObjectToValueObject = (
    projectId: ProjectViewObject['id'],
    updateProjectViewObject: UpdateProjectViewObject
): UpdateProjectValueObject => {
    const valueObject = new UpdateProjectValueObject(projectId)
    if (updateProjectViewObject.name) {
        valueObject.name = updateProjectViewObject.name
    }
    if (updateProjectViewObject.icon) {
        valueObject.icon = updateProjectViewObject.icon || 'more2'
    }
    if (updateProjectViewObject.description) {
        valueObject.description = updateProjectViewObject.description || ''
    }
    if (updateProjectViewObject.sortId !== void 0) {
        valueObject.sortId = updateProjectViewObject.sortId
    }
    return valueObject
}

