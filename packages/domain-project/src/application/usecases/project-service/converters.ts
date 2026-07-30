import {
    type GetTasksOptions,
    JsonStringValueObject,
    type TaskColumnOptions
} from '@nao-todo/shared'
import dayjs from 'dayjs'
import {
    CreateProjectValueObject,
    ProjectEntity,
    ProjectPreferenceEntity,
    UpdateProjectValueObject
} from '../../../domain'
import type {
    CreateProjectViewObject,
    ProjectPreferenceViewObject,
    ProjectViewObject,
    UpdateProjectViewObject
} from '../../viewobjects'

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
    const vo = {} as ProjectPreferenceViewObject
    // vo.id = entity.id
    vo.projectId = entity.projectId
    vo.viewType = entity.viewType
    vo.getTasksOptions = entity.getTasksOptions.value as GetTasksOptions
    vo.columns = entity.columns.value as TaskColumnOptions
    // console.log(entity)
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
        JsonStringValueObject.CreateByObject(projectPreferenceViewObject.getTasksOptions),
        JsonStringValueObject.CreateByObject(projectPreferenceViewObject.columns)
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