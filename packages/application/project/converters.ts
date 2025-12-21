import type { ProjectEntity, ProjectPreferenceEntity } from '@nao-todo/domain/project'
import type { ProjectPreferenceVO, ProjectVO, UpdateProjectVO } from '@nao-todo/types'
import jsonParse from '@nao-todo/infrastructure/utils/json-parse'
import { makeProjectEntity, makeProjectPreferenceEntity } from '@nao-todo/domain/project/entities'

export const projectEntity2ProjectVO = (projectEntity: ProjectEntity): ProjectVO => {
    const projectVO = {} as ProjectVO
    projectVO.id = projectEntity.id
    projectVO.icon = projectEntity.icon
    projectVO.name = projectEntity.name
    projectVO.description = projectEntity.description
    projectVO.archivedAt = projectEntity.archivedAt
    projectVO.createdAt = projectEntity.createdAt
    projectVO.updatedAt = projectEntity.updatedAt
    return projectVO
}

export const projectEntities2ProjectVO = (projectEntities: ProjectEntity[]): ProjectVO[] => {
    return projectEntities.map(projectEntity2ProjectVO)
}

export const projectPreferenceEntity2ProjectPreferenceVO = (
    entity: ProjectPreferenceEntity
): ProjectPreferenceVO => {
    const vo = {} as ProjectPreferenceVO
    vo.id = entity.id
    vo.projectId = entity.projectId
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

export const projectVO2Entity = (vo: ProjectVO): ProjectEntity => {
    const entity = makeProjectEntity()
    entity.id = vo.id
    entity.icon = vo.icon
    entity.name = vo.name
    entity.description = vo.description
    entity.archivedAt = vo.archivedAt
    return entity
}

export const updateProjectVO2Entity = (vo: UpdateProjectVO): ProjectEntity => {
    const entity = makeProjectEntity()
    entity.icon = vo.icon
    entity.name = vo.name || ''
    entity.description = vo.description || ''
    entity.archivedAt = vo.archivedAt || ''
    return entity
}

export const projectPreferenceVO2Entity = (vo: ProjectPreferenceVO): ProjectPreferenceEntity => {
    const entity = makeProjectPreferenceEntity()
    entity.id = vo.id
    entity.projectId = vo.projectId
    entity.viewType = vo.viewType
    entity.getTasksOptions = JSON.stringify(vo.getTasksOptions)
    entity.columns = JSON.stringify(vo.columns)
    return entity
}
