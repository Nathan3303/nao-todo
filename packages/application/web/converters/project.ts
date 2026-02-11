import {
    makeProjectPreferenceEntity,
    type ProjectEntity,
    type ProjectPreferenceEntity
} from '@nao-todo/domain/project/entities'
import jsonParse from '@nao-todo/infrastructure/utils/json-parse'
import type { Project, ProjectPreference } from '@nao-todo/types'

export const projectEntity2ViewObject = (projectEntity: ProjectEntity): Project => {
    const vo = {} as Project
    vo.id = projectEntity.id
    vo.icon = projectEntity.icon || 'more2'
    vo.name = projectEntity.name
    vo.description = projectEntity.description
    vo.archivedAt = projectEntity.archivedAt
    vo.createdAt = projectEntity.createdAt
    vo.updatedAt = projectEntity.updatedAt
    return vo
}

export const projectEntities2ViewObject = (projectEntities: ProjectEntity[]): Project[] => {
    return projectEntities.map(projectEntity2ViewObject)
}

export const projectPreferenceEntity2ProjectPreferenceVO = (
    entity: ProjectPreferenceEntity
): ProjectPreference => {
    const vo = {} as ProjectPreference
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

// export const projectVO2Entity = (vo: ProjectVO): ProjectEntity => {
//     const entity = makeProjectEntity()
//     entity.id = vo.id
//     entity.icon = vo.icon
//     entity.name = vo.name
//     entity.description = vo.description
//     entity.archivedAt = vo.archivedAt
//     return entity
// }

// export const updateProjectVO2Entity = (vo: UpdateProjectVO): ProjectEntity => {
//     const entity = makeProjectEntity()
//     entity.icon = vo.icon
//     entity.name = vo.name || ''
//     entity.description = vo.description || ''
//     entity.archivedAt = vo.archivedAt || ''
//     return entity
// }

export const projectPreferenceVO2Entity = (vo: ProjectPreference): ProjectPreferenceEntity => {
    const entity = makeProjectPreferenceEntity()
    entity.id = vo.id
    entity.projectId = vo.projectId
    entity.viewType = vo.viewType
    entity.getTasksOptions = JSON.stringify(vo.getTasksOptions)
    entity.columns = JSON.stringify(vo.columns)
    return entity
}
