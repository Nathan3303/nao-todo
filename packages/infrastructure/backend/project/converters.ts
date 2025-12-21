import {
    makeProjectEntity,
    makeProjectPreferenceEntity,
    type ProjectEntity,
    type ProjectPreferenceEntity
} from '@nao-todo/domain/project/entities'
import type {
    CreateProjectRes,
    GetProjectPreferenceRes,
    GetProjectRes,
    ListProjectRes
} from '../types'

export const getProjectRes2ProjectEntity = (res: GetProjectRes): ProjectEntity => {
    const e = makeProjectEntity()
    e.id = res.id
    e.name = res.name
    e.description = res.description
    e.archivedAt = res.archivedAt
    return e
}

export const createProjectRes2ProjectEntity = (res: CreateProjectRes): ProjectEntity => {
    return getProjectRes2ProjectEntity(res)
}

export const listProjectRes2ProjectEntities = (res: ListProjectRes): ProjectEntity[] => {
    return res.map((project) => getProjectRes2ProjectEntity(project))
}

export const getProjectPreferenceRes2ProjectPreferenceEntity = (
    res: GetProjectPreferenceRes
): ProjectPreferenceEntity => {
    const e = makeProjectPreferenceEntity()
    e.viewType = res.viewType
    e.getTasksOptions = res.getTasksOptions
    e.columns = res.columns
    return e
}
