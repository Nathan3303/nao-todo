import { TagEntity } from '@nao-todo/domain/tag/entities'
import type { CreateTagRes, GetTagRes, ListTagRes } from '../types'

export const getTagRes2TagEntity = (res: GetTagRes): TagEntity => {
    const e = new TagEntity()
    e.id = res.id
    e.name = res.name
    e.description = res.description
    e.color = res.color
    return e
}

export const createTagRes2TagEntity = (res: CreateTagRes): TagEntity => {
    const e = new TagEntity()
    e.id = res.id
    e.name = res.name
    e.description = res.description
    e.color = res.color
    return e
}

export const listTagRes2TagEntities = (res: ListTagRes): TagEntity[] => {
    return res.map((p) => {
        const e = new TagEntity()
        e.id = p.id
        e.name = p.name
        e.description = p.description
        e.color = p.color
        return e
    })
}
