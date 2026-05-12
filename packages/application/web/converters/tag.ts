import {
    CreateTagValueObject,
    TagEntity,
    TagPreferenceEntity,
    UpdateTagValueObject
} from '@nao-todo/domain/tag'
import { defaultColumns } from '@nao-todo/infrastructure/consts/tasks'
import jsonParse from '@nao-todo/infrastructure/utils/json-parse'
import type {
    TagViewObject,
    TagPreferenceViewObject,
    CreateTagViewObject,
    UpdateTagViewObject
} from '@nao-todo/types'

/**
 * 转换 TagEntity 为 TagViewObject
 * @param tagEntity 标签实体
 * @returns 标签视图对象
 */
export const tagEntityToViewObject = (tagEntity: TagEntity): TagViewObject => {
    return {
        id: tagEntity.id,
        name: tagEntity.name,
        description: tagEntity.description,
        color: tagEntity.color,
        createdAt: tagEntity.createdAt,
        updatedAt: tagEntity.updatedAt
    } as TagViewObject
}

/**
 * 转换 TagEntity[] 为 TagViewObject[]
 * @param tagEntities 标签实体数组
 * @returns 标签视图对象数组
 */
export const tagEntitiesToViewObjects = (tagEntities: TagEntity[]): TagViewObject[] => {
    return tagEntities.map(tagEntityToViewObject)
}

/**
 * 转换 TagPreferenceEntity 为 TagPreferenceViewObject
 * @param tagPreferenceEntity 标签偏好实体
 * @returns 标签偏好视图对象
 */
export const tagPreferenceEntityToViewObject = (
    tagPreferenceEntity: TagPreferenceEntity
): TagPreferenceViewObject => {
    const [getTasksOptions, err1] = jsonParse(tagPreferenceEntity.getTasksOptions)
    const [columns, err2] = jsonParse(tagPreferenceEntity.columns)
    const vo = {} as TagPreferenceViewObject
    vo.id = tagPreferenceEntity.id
    vo.tagId = tagPreferenceEntity.tagId
    vo.viewType = tagPreferenceEntity.viewType
    vo.getTasksOptions = err1 !== null ? { limit: 20 } : getTasksOptions
    vo.columns = err2 !== null ? defaultColumns : { ...defaultColumns, ...columns }
    return vo
}

/**
 * 转换 TagPreferenceViewObject 为 TagPreferenceEntity
 * @param tagPreferenceViewObject 标签偏好视图对象
 * @returns 标签偏好实体
 */
export const tagPreferenceViewObjectToEntity = (
    tagPreferenceViewObject: TagPreferenceViewObject
): TagPreferenceEntity => {
    return new TagPreferenceEntity(
        tagPreferenceViewObject.id,
        '',
        tagPreferenceViewObject.tagId,
        tagPreferenceViewObject.viewType,
        JSON.stringify(tagPreferenceViewObject.getTasksOptions),
        JSON.stringify(tagPreferenceViewObject.columns)
    )
}

/**
 * 转换 CreateTagViewObject 为 CreateTagValueObject
 * @param createTagViewObject 创建标签视图对象
 * @returns 创建标签值对象
 */
export const createTagViewObjectToValueObject = (
    createTagViewObject: CreateTagViewObject
): CreateTagValueObject => {
    return new CreateTagValueObject(
        '', //TODO: 从领域层获取标签ID
        createTagViewObject.name,
        createTagViewObject.description || '',
        createTagViewObject.color || 'transparent',
        createTagViewObject.icon || 'tag'
    )
}

/**
 * 转换 UpdateTagViewObject 为 UpdateTagValueObject
 * @param updateTagViewObject 更新标签视图对象
 * @returns 更新标签值对象
 */
export const updateTagViewObjectToValueObject = (
    tagId: TagViewObject['id'],
    updateTagViewObject: UpdateTagViewObject
): UpdateTagValueObject => {
    const updateTagValueObject = new UpdateTagValueObject(tagId)
    if (updateTagViewObject.name) updateTagValueObject.name = updateTagViewObject.name
    if (updateTagViewObject.description)
        updateTagValueObject.description = updateTagViewObject.description
    if (updateTagViewObject.color) updateTagValueObject.color = updateTagViewObject.color
    return updateTagValueObject
}


