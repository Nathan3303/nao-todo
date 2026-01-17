import type { TagEntity } from '@nao-todo/domain/tag'
import { makeTagPreferenceEntity, type TagPreferenceEntity } from '@nao-todo/domain/tag/entities'
import jsonParse from '@nao-todo/infrastructure/utils/json-parse'
import type { TagPreferenceVO, TagVO } from '@nao-todo/types'

export const tagEntity2TagVO = (tagEntity: TagEntity): TagVO => {
    const vo = {} as TagVO
    vo.id = tagEntity.id
    vo.name = tagEntity.name
    vo.description = tagEntity.description
    vo.color = tagEntity.color
    vo.createdAt = tagEntity.createdAt
    vo.updatedAt = tagEntity.updatedAt
    return vo
}

export const tagEntities2TagVO = (tagEntities: TagEntity[]): TagVO[] => {
    return tagEntities.map(tagEntity2TagVO)
}

export const tagPreferenceEntity2TagPreferenceVO = (
    entity: TagPreferenceEntity
): TagPreferenceVO => {
    const vo = {} as TagPreferenceVO
    vo.id = entity.id
    vo.tagId = entity.tagId
    vo.viewType = entity.viewType

    const [getTasksOptions, err1] = jsonParse(entity.getTasksOptions)
    vo.getTasksOptions = err1 !== null ? { limit: 20 } : getTasksOptions

    const [columns, err2] = jsonParse(entity.columns)
    vo.columns =
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
    return vo
}

export const tagPreferenceVO2Entity = (vo: TagPreferenceVO): TagPreferenceEntity => {
    const entity = makeTagPreferenceEntity()
    entity.id = vo.id
    entity.tagId = vo.tagId
    entity.viewType = vo.viewType
    entity.getTasksOptions = JSON.stringify(vo.getTasksOptions)
    entity.columns = JSON.stringify(vo.columns)
    return entity
}
