import { ProjectEntity, ProjectPreferenceEntity } from '@nao-todo/domain/project/entities'
import { CreateProjectValueObject } from '@nao-todo/domain/project/valueobjects'
import jsonParse from '@nao-todo/infrastructure/utils/json-parse'
import type {
    ProjectViewObject,
    ProjectPreferenceViewObject,
    CreateProjectViewObject
} from '@nao-todo/types'
import dayjs from 'dayjs'

/**
 * 将项目实体转换为项目视图对象
 * @param projectEntity 项目实体
 * @returns 项目视图对象
 */
export const projectEntityToViewObject = (projectEntity: ProjectEntity): ProjectViewObject => {
    return {
        id: projectEntity.id,
        icon: projectEntity.icon || 'more2',
        name: projectEntity.name,
        description: projectEntity.description,
        archivedAt: projectEntity.archivedAt,
        createdAt: projectEntity.createdAt,
        updatedAt: projectEntity.updatedAt,
        isArchived: dayjs(projectEntity.archivedAt).isValid(),
        // isDeleted: dayjs(projectEntity.deletedAt).isValid()
        createTaskOptions: { projectId: projectEntity.id }
    } as ProjectViewObject
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
    const projectPreferenceViewObject = {} as ProjectPreferenceViewObject
    projectPreferenceViewObject.id = entity.id
    projectPreferenceViewObject.projectId = entity.projectId
    projectPreferenceViewObject.viewType = entity.viewType

    const [getTasksOptions, err1] = jsonParse(entity.getTasksOptions)
    projectPreferenceViewObject.getTasksOptions = err1 !== null ? { limit: 20 } : getTasksOptions
    if (!projectPreferenceViewObject.projectId) {
        projectPreferenceViewObject.projectId = entity.projectId
    }

    const [columns, err2] = jsonParse(entity.columns)
    projectPreferenceViewObject.columns =
        err2 !== null
            ? {
                  state: true,
                  priority: true,
                  endAt: true,
                  project: false,
                  tags: false,
                  description: false,
                  createdAt: false,
                  updatedAt: false,
                  startAt: false
              }
            : columns
    return projectPreferenceViewObject
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
        projectPreferenceViewObject.projectId,
        projectPreferenceViewObject.viewType,
        JSON.stringify(projectPreferenceViewObject.getTasksOptions),
        JSON.stringify(projectPreferenceViewObject.columns),
        projectPreferenceViewObject.createdAt,
        projectPreferenceViewObject.updatedAt
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

