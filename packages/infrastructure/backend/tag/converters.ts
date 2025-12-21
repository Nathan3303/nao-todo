import {
    makeTagEntity,
    makeTagPreferenceEntity,
    TagPreferenceEntity,
    type TagEntity
} from '@nao-todo/domain/tag/entities'
import type { CreateTagRes, GetTagPreferenceRes, GetTagRes, ListTagRes } from '../types'

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
    return res.map((p) => {
        const e = makeTagEntity()
        e.id = p.id
        e.name = p.name
        e.description = p.description
        e.color = p.color
        return e
    })
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
