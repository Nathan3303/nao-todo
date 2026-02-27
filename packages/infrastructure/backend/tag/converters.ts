import {
    makeTagEntity,
    makeTagPreferenceEntity,
    type TagPreferenceEntity,
    type TagEntity
} from '@nao-todo/domain/tag/entities'
import type {
    CreateTagRes,
    GetTagPreferenceRes,
    GetTagRes,
    ListTagRes,
    UpdateTagPreferenceReq
} from '../types'

export const getTagRes2TagEntity = (res: GetTagRes): TagEntity => {
    const e = makeTagEntity()
    e.id = res.id
    e.name = res.name
    e.description = res.description
    e.color = res.color
    return e
}

export const createTagRes2TagEntity = (res: CreateTagRes): TagEntity => {
    const e = makeTagEntity()
    e.id = res.id
    e.name = res.name
    e.description = res.description
    e.color = res.color
    return e
}

export const listTagRes2TagEntities = (res: ListTagRes): TagEntity[] => {
    return res.map((p) => getTagRes2TagEntity(p))
}

export const getTagPreferenceRes2TagPreferenceEntity = (
    res: GetTagPreferenceRes
): TagPreferenceEntity => {
    const e = makeTagPreferenceEntity()
    e.viewType = res.viewType
    e.getTasksOptions = res.getTasksOptions
    e.columns = res.columns
    return e
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
