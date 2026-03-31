import { TagPreferenceEntity, TagEntity } from '@nao-todo/domain/tag/entities'
import type {
    CreateTagRes,
    GetTagPreferenceRes,
    GetTagRes,
    ListTagRes,
    UpdateTagPreferenceReq
} from '../types'

export const getTagRes2TagEntity = (res: GetTagRes): TagEntity => {
    return new TagEntity(
        res.id,
        '', //TODO: 从接口返回 USERID
        res.name,
        res.color,
        res.description,
        '',
        ''
    )
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
    const rto = { preference: {} } as UpdateTagPreferenceReq
    rto.preference.viewType = tagPreferenceEntity.viewType
    rto.preference.getTasksOptions = tagPreferenceEntity.getTasksOptions
    rto.preference.columns = tagPreferenceEntity.columns
    return rto
}
