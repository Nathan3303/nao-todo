import {
    TagPreferenceEntity,
    TagEntity,
    UpdateTagValueObject,
    CreateTagValueObject,
    UpdateTagPreferenceValueObject
} from '@nao-todo/domain/tag'
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
import { defaultColumns } from '../../consts/tasks'

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
export const createTagValueObject2Req = (createVO: CreateTagValueObject): CreateTagReq => {
    const req = {} as CreateTagReq
    req.name = createVO.name
    req.description = createVO.description || ''
    req.color = createVO.color || 'transparent'
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
export const updateTagValueObject2Req = (updateVO: UpdateTagValueObject): UpdateTagReq => {
    const req: UpdateTagReq = {}
    if (updateVO.id) req.id = updateVO.id
    if (updateVO.name) req.name = updateVO.name
    if (updateVO.description) req.description = updateVO.description
    if (updateVO.color) req.color = updateVO.color
    if (updateVO.sortId !== undefined) req.sortId = updateVO.sortId
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
        res.getTasksOptions,
        res.columns
    )
}

/**
 * 创建默认标签偏好实体
 * @returns 默认标签偏好实体
 */
export const defaultTagPreferenceRes2Entity = (): TagPreferenceEntity => {
    const today = dayjs().toISOString()
    return new TagPreferenceEntity(
        '',
        today,
        today,
        null,
        '',
        'table',
        '{}',
        JSON.stringify(defaultColumns)
    )
}

/**
 * 更新标签偏好值对象转换为更新标签偏好请求
 * @param updateVO 更新标签偏好值对象
 * @returns 更新标签偏好请求
 */
export const updateTagPreferenceValueObject2Req = (
    updateVO: UpdateTagPreferenceValueObject
): UpdateTagPreferenceReq => {
    const rto = {} as UpdateTagPreferenceReq
    if (updateVO.viewType !== void 0) rto.viewType = updateVO.viewType
    if (updateVO.getTasksOptions !== void 0) rto.getTasksOptions = updateVO.getTasksOptions
    if (updateVO.columns !== void 0) rto.columns = updateVO.columns
    return rto
}



