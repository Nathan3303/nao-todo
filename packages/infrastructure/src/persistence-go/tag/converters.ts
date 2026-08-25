import { TagPreferenceEntity, TagEntity } from '@nao-todo/domain-tag'
import type {
    CreateTagRes,
    TagPreferenceRes,
    ListTagRes,
    UpdateTagPreferenceReq,
    UpdateTagReq,
    TagRes,
    CreateTagReq
} from '../models'
import dayjs from 'dayjs'
import { defaultColumns } from '@nao-todo/shared/constants/task'
import { JsonStringValueObject } from '@nao-todo/shared/valueobjects/json-string'

// --- Tag ---

/**
 * 标签响应转换为标签实体
 * @param res 标签响应
 * @returns 标签实体
 */
export const tagRes2Entity = (res: TagRes): TagEntity => {
    return new TagEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        // res.userId,
        'tag',
        res.name,
        res.description,
        res.color,
        res.sortId
    )
}

/**
 * 创建标签值对象转换为创建标签请求
 * @param createVO 创建标签值对象
 * @returns 创建标签请求
 */
export const tagEntity2CreateReq = (entity: TagEntity): CreateTagReq => {
    const req = {} as CreateTagReq
    req.name = entity.name
    req.description = entity.description
    req.color = entity.color
    return req
}

/**
 * 创建标签响应转换为标签实体
 * @param res 创建标签响应
 * @returns 标签实体
 */
export const createTagRes2Entity = (res: CreateTagRes): TagEntity => {
    return tagRes2Entity(res)
}

/**
 * 更新标签值对象转换为更新标签请求
 * @param updateVO 更新标签值对象
 * @returns 更新标签请求
 */
export const tagEntity2UpdateReq = (entity: TagEntity): UpdateTagReq => {
    const req: UpdateTagReq = {
        id: entity.id,
        name: entity.name,
        description: entity.description,
        color: entity.color,
        sortId: entity.sortId
    }
    return req
}

/**
 * 标签列表响应转换为标签实体列表
 * @param res 标签列表响应
 * @returns 标签实体列表
 */
export const listTagRes2Entities = (res: ListTagRes): TagEntity[] => {
    return res.map((p) => tagRes2Entity(p))
}

// --- Tag Preference ---

/**
 * 标签偏好响应转换为标签偏好实体
 * @param res 标签偏好响应
 * @returns 标签偏好实体
 */
export const tagPreferenceRes2Entity = (res: TagPreferenceRes): TagPreferenceEntity => {
    return new TagPreferenceEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        // res.userId,
        res.tagId,
        res.viewType,
        JsonStringValueObject.CreateByJsonString(res.getTasksOptions),
        JsonStringValueObject.CreateByJsonString(res.columns)
    )
}

/**
 * 创建默认标签偏好实体
 * @param tagId 标签 ID（默认偏好的 getTasksOptions 须含 tagId，
 *              否则标签面板任务查询无标签过滤，会误展示无该标签的任务）
 */
export const defaultTagPreferenceRes2Entity = (tagId: string): TagPreferenceEntity => {
    const today = dayjs().toISOString()
    return new TagPreferenceEntity(
        '',
        today,
        today,
        null,
        tagId,
        'table',
        JsonStringValueObject.CreateByJsonString(`{"tagId":"${tagId}"}`),
        JsonStringValueObject.CreateByObject(defaultColumns)
    )
}

/**
 * 标签偏好实体转换为更新标签偏好请求
 * @param updatedEntity 更新后的标签偏好实体
 * @returns 更新标签偏好请求
 */
export const tagPreferenceEntity2UpdateReq = (
    updatedEntity: TagPreferenceEntity
): UpdateTagPreferenceReq => {
    const rto = {} as UpdateTagPreferenceReq
    rto.viewType = updatedEntity.viewType
    rto.getTasksOptions = updatedEntity.getTasksOptions.unmarshal()
    rto.columns = updatedEntity.columns.unmarshal()
    return rto
}