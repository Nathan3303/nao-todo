import { TagPreferenceEntity, TagEntity, UpdateTagValueObject } from '@nao-todo/domain/tag'
import type {
    CreateTagRes,
    GetTagPreferenceRes,
    GetTagRes,
    ListTagRes,
    UpdateTagPreferenceReq,
    UpdateTagReq,
    BatchUpdateTagRes
} from '../types'

export const getTagRes2TagEntity = (res: GetTagRes): TagEntity => {
    return new TagEntity(
        res.id,
        '', //TODO: 从接口返回 USERID
        res.name,
        res.color,
        res.description,
        '',
        '',
        res.sortId
    )
}

export const updateTagValueObjectToUpdateTagReq = (
    updateTagValueObject: UpdateTagValueObject
): UpdateTagReq => {
    const rto: UpdateTagReq = {}
    if (updateTagValueObject.id) rto.id = updateTagValueObject.id
    if (updateTagValueObject.name) rto.name = updateTagValueObject.name
    if (updateTagValueObject.description) rto.description = updateTagValueObject.description
    if (updateTagValueObject.color) rto.color = updateTagValueObject.color
    if (updateTagValueObject.sortId !== undefined) rto.sortId = updateTagValueObject.sortId
    return rto
}

export const createTagRes2TagEntity = (res: CreateTagRes): TagEntity => {
    return getTagRes2TagEntity(res)
}

export const listTagRes2TagEntities = (res: ListTagRes): TagEntity[] => {
    return res.map((p) => getTagRes2TagEntity(p))
}

export const getTagPreferenceRes2TagPreferenceEntity = (
    res: GetTagPreferenceRes
): TagPreferenceEntity => {
    return new TagPreferenceEntity(
        '', //TODO: 从接口返回 ID
        '', //TODO: 从接口返回 USERID
        '', //TODO: 从接口返回 TAGID
        res.viewType,
        res.getTasksOptions,
        res.columns
    )
}

export const tagPreferenceEntity2UpdateReq = (
    tagPreferenceEntity: TagPreferenceEntity
): UpdateTagPreferenceReq => {
    const rto = {} as UpdateTagPreferenceReq
    rto.viewType = tagPreferenceEntity.viewType
    rto.getTasksOptions = tagPreferenceEntity.getTasksOptions
    rto.columns = tagPreferenceEntity.columns
    return rto
}

export const batchUpdateTagRes2BatchUpdateTagResult = (res: BatchUpdateTagRes) => {
    return {
        updatedCount: res.updatedCount,
        tags: res.tags.map((tag) => getTagRes2TagEntity(tag))
    }
}

